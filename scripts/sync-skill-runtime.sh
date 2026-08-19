#!/usr/bin/env bash
#
# Mirror this checkout's skill source into the installed runtime and prove it.
#
# This automates the "Runtime Sync" sequence in AGENTS.md. It is maintainer-only:
# on a machine without an installed runtime (clones, CI, cloud sessions) it exits
# 0 after saying so, because `npm run audit:ci` is the readiness gate there.
# Pass --bootstrap to create one deliberately instead of skipping.
#
# Claude and Agents read the Codex runtime copy through symlinks, so syncing
# ~/.codex/skills/ updates every consumer at once. That also means deleting the
# Codex runtime leaves those symlinks DANGLING and the skill silently resolves
# to nothing in both tools — --bootstrap is the repair for exactly that state.
#
# Usage:
#   npm run sync:runtime                # full sync + verification
#   npm run sync:runtime -- --dry-run   # preview changes, mutate nothing
#   npm run sync:runtime -- --no-pull   # skip the git pull (use the working tree as-is)
#   npm run sync:runtime -- --bootstrap # create the runtime when none exists yet

set -euo pipefail

SKILL_NAME="formation"
SOURCE_REL="skill/${SKILL_NAME}"
RUNTIME="${HOME}/.codex/skills/${SKILL_NAME}"
# Every tool that reads this skill points at the one Codex runtime copy, so a
# single sync updates all of them. Cursor reads ~/.cursor/skills (its own
# built-ins live in ~/.cursor/skills-cursor, which is vendor-owned — never sync
# there). A consumer absent from this list is a consumer that silently goes stale.
CONSUMER_LINKS=(
  "${HOME}/.claude/skills/${SKILL_NAME}"
  "${HOME}/.agents/skills/${SKILL_NAME}"
  "${HOME}/.cursor/skills/${SKILL_NAME}"
)

DRY_RUN=0
DO_PULL=1
BOOTSTRAP=0
BOOTSTRAPPED=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-pull) DO_PULL=0 ;;
    --bootstrap) BOOTSTRAP=1 ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $arg (try --help)" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[31mFAIL: %s\033[0m\n' "$1" >&2; exit 1; }
warn() { printf '\033[33mWARN: %s\033[0m\n' "$1" >&2; }

# --- 0. Must run from the repo root, against the real source tree ------------
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "not inside a git repository"
cd "$REPO_ROOT"
[ -f "${SOURCE_REL}/SKILL.md" ] || fail "no ${SOURCE_REL}/SKILL.md here — this is not the skill repo"

# --- 1. Missing runtime: skip by default, create under --bootstrap -----------
# Skipping is right for clones, CI, and cloud sessions, which legitimately have
# no install. It is wrong when the install was deleted on a maintainer machine:
# the consumer symlinks survive as dangling links, so Claude and Codex keep
# listing the skill while every read of it resolves to nothing. --bootstrap
# makes recovering from that an explicit, one-flag operation instead of a
# hand-run rsync nobody remembers the arguments for.
if [ ! -d "$RUNTIME" ]; then
  # A dangling consumer link is the tell that this machine HAD a runtime.
  DANGLING=()
  for link in "${CONSUMER_LINKS[@]}"; do
    if [ -L "$link" ] && [ ! -e "$link" ]; then DANGLING+=("$link"); fi
  done

  if [ "$BOOTSTRAP" -eq 0 ]; then
    echo "No installed runtime at ${RUNTIME}."
    echo "Runtime sync is maintainer-machine only; 'npm run audit:ci' is the readiness gate here."
    if [ "${#DANGLING[@]}" -gt 0 ]; then
      printf '\n\033[33mBut this machine has %d dangling consumer symlink(s):\033[0m\n' "${#DANGLING[@]}"
      printf '  %s\n' "${DANGLING[@]}"
      echo "They point at the missing runtime, so the skill resolves to nothing in those tools."
      echo "Create the runtime and repair them with:"
      echo "    npm run sync:runtime -- --bootstrap"
    fi
    exit 0
  fi

  BOOTSTRAPPED=1
  step "Bootstrapping a new runtime at ${RUNTIME}"
  if [ "${#DANGLING[@]}" -gt 0 ]; then
    echo "repairing ${#DANGLING[@]} dangling consumer symlink(s):"
    printf '  %s\n' "${DANGLING[@]}"
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "(--dry-run: would create ${RUNTIME}; the mirror preview below lists it as all-new)"
  else
    # rsync creates the leaf directory but not missing parents.
    mkdir -p "$RUNTIME"
    echo "created ${RUNTIME}"
  fi
elif [ "$BOOTSTRAP" -eq 1 ]; then
  echo "(--bootstrap given, but a runtime already exists at ${RUNTIME} — syncing it normally)"
fi

# --- 2. Sync source from origin/main ----------------------------------------
if [ "$DO_PULL" -eq 1 ]; then
  step "Updating source from origin/main"
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [ "$BRANCH" != "main" ]; then
    # Silently syncing from a side branch is how stale or half-finished work
    # reaches the runtime. Make the operator opt in.
    warn "on branch '${BRANCH}', not main."
    read -r -p "Sync the runtime from '${BRANCH}' as-is? [y/N] " reply </dev/tty
    case "$reply" in [yY]*) DO_PULL=0 ;; *) fail "aborted; switch to main or pass --no-pull deliberately" ;; esac
  fi
  if [ "$DO_PULL" -eq 1 ]; then
    [ -z "$(git status --porcelain)" ] || fail "working tree is dirty; commit or stash before pulling"
    git pull --ff-only origin main
  fi
fi

echo "Source version: $(node -p "require('./${SOURCE_REL}/skill-version.json').version")"
echo "Runtime version: $(node -p "require('${RUNTIME}/skill-version.json').version" 2>/dev/null || echo 'unknown')"

# --- 3. Prove the source is green before mirroring anything ------------------
step "Auditing source"
# `npm install` may rewrite optional-platform metadata when the maintainer's
# npm version differs from the one that produced the committed lockfile. A
# runtime sync must preserve byte parity, so install exactly from the lockfile
# and fail instead of updating it.
npm ci --silent --no-audit --no-fund
npm run audit

# --- 4. Mirror source -> runtime --------------------------------------------
# node_modules and .DS_Store are excluded: they are per-install artifacts, and
# mirroring them would both break the parity diff and wipe the runtime's deps.
# --checksum compares content rather than size+mtime: the runtime's own `npm
# install` rewrites its package-lock.json mtime, which would otherwise report as
# a change on every run and make the "already in sync" preview unreachable.
# The tree is ~6MB, so hashing it costs nothing measurable.
RSYNC_ARGS=(-a --checksum --delete --exclude 'node_modules/' --exclude '.DS_Store')

step "Mirror preview (${SOURCE_REL}/ -> ${RUNTIME}/)"
PREVIEW="$(rsync "${RSYNC_ARGS[@]}" --itemize-changes --dry-run "${SOURCE_REL}/" "${RUNTIME}/")"
# An itemize line starting with '.' means no data is transferred — only an
# attribute (usually mtime) is touched up. Those are noise: report content.
CONTENT_CHANGES="$(printf '%s\n' "$PREVIEW" | grep -v '^\.' | grep -v '^$' || true)"
if [ -z "$CONTENT_CHANGES" ]; then
  echo "(already in sync — no content changes)"
else
  echo "$CONTENT_CHANGES"
fi
# Deletions are legitimate when a file is dropped upstream, but they are the
# destructive half of --delete, so surface them on their own line.
DELETIONS="$(printf '%s\n' "$PREVIEW" | grep '^\*deleting' || true)"
if [ -n "$DELETIONS" ]; then
  printf '\n\033[33mThe following runtime files will be REMOVED:\033[0m\n%s\n' "$DELETIONS"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  step "--dry-run: stopping before any mutation"
  exit 0
fi

step "Mirroring"
rsync "${RSYNC_ARGS[@]}" "${SOURCE_REL}/" "${RUNTIME}/"
echo "mirrored."

# --- 5. Audit the runtime copy itself ---------------------------------------
# The runtime legitimately runs one fewer gate than the repo: check:package-parity
# compares the repo root package.json to the skill's, and there is no repo root here.
step "Auditing installed runtime"
( cd "$RUNTIME" && npm ci --silent --no-audit --no-fund && npm run audit )

# --- 6. Prove byte parity ----------------------------------------------------
step "Verifying parity"
if diff -qr -x node_modules -x .DS_Store "$SOURCE_REL" "$RUNTIME"; then
  echo "parity OK: source and runtime are byte-identical."
else
  fail "runtime drifted from source after sync (see diff above)"
fi

# --- 7. Verify the Claude/Agents/Cursor consumers point at the Codex runtime -
step "Verifying consumer symlinks"
for link in "${CONSUMER_LINKS[@]}"; do
  if [ -L "$link" ]; then
    target="$(readlink "$link")"
    if [ "$target" = "$RUNTIME" ]; then
      echo "OK    ${link} -> ${target}"
    else
      warn "repointing ${link} (was -> ${target})"
      ln -sfn "$RUNTIME" "$link"
      echo "OK    ${link} -> ${RUNTIME}"
    fi
  elif [ -d "$link" ]; then
    # A real directory here is a genuine fork of the skill: it will silently keep
    # serving stale content forever. Refuse to delete someone's directory
    # unattended, but do not let the run report success either.
    fail "${link} is a real directory, not a symlink — it will NOT receive this update.
      Inspect it, then replace it deliberately:
        rm -rf '${link}' && ln -s '${RUNTIME}' '${link}'"
  else
    echo "creating ${link}"
    mkdir -p "$(dirname "$link")"
    ln -s "$RUNTIME" "$link"
    echo "OK    ${link} -> ${RUNTIME}"
  fi
done

# --- 8. Legacy aliases (pre-rename name) --------------------------------------
# Repos shipped before the formation rename invoke the skill as
# b2c-mobile-business-launch and read it through same-named paths. Skill
# resolution follows the directory/symlink basename, so a compat symlink under
# the old name keeps every one of those references working. Repoint or create
# symlinks freely; never delete a real directory unattended (the pre-cutover
# ~/.codex/skills runtime is one until it is deliberately replaced).
LEGACY_NAME="b2c-mobile-business-launch"
step "Maintaining legacy '${LEGACY_NAME}' aliases"
LEGACY_LINKS=(
  "${HOME}/.codex/skills/${LEGACY_NAME}"
  "${HOME}/.claude/skills/${LEGACY_NAME}"
  "${HOME}/.agents/skills/${LEGACY_NAME}"
  "${HOME}/.cursor/skills/${LEGACY_NAME}"
)
for link in "${LEGACY_LINKS[@]}"; do
  if [ -L "$link" ]; then
    target="$(readlink "$link")"
    if [ "$target" = "$RUNTIME" ]; then
      echo "OK    ${link} -> ${target}"
    else
      warn "repointing legacy alias ${link} (was -> ${target})"
      ln -sfn "$RUNTIME" "$link"
      echo "OK    ${link} -> ${RUNTIME}"
    fi
  elif [ -d "$link" ]; then
    warn "${link} is still a real directory (pre-rename runtime). Cut over deliberately:
        rm -rf '${link}' && ln -s '${RUNTIME}' '${link}'"
  else
    echo "creating legacy alias ${link}"
    mkdir -p "$(dirname "$link")"
    ln -s "$RUNTIME" "$link"
    echo "OK    ${link} -> ${RUNTIME}"
  fi
done

# --- 9. Freshness gate -------------------------------------------------------
step "Skill version freshness"
npm run check:skill-version --silent -- --source "$SOURCE_REL" --installed "$RUNTIME"

if [ "$BOOTSTRAPPED" -eq 1 ]; then
  step "Runtime bootstrap complete"
  echo "Created ${RUNTIME} and pointed every consumer at it."
else
  step "Runtime sync complete"
fi
