#!/usr/bin/env bash
#
# Mirror this checkout's skill source into the installed runtime and prove it.
#
# This automates the "Runtime Sync" sequence in AGENTS.md. It is maintainer-only:
# on a machine without an installed runtime (clones, CI, cloud sessions) it exits
# 0 after saying so, because `npm run audit:ci` is the readiness gate there.
#
# Claude and Agents read the Codex runtime copy through symlinks, so syncing
# ~/.codex/skills/ updates every consumer at once.
#
# Usage:
#   npm run sync:runtime              # full sync + verification
#   npm run sync:runtime -- --dry-run # preview changes, mutate nothing
#   npm run sync:runtime -- --no-pull # skip the git pull (use the working tree as-is)

set -euo pipefail

SKILL_NAME="b2c-mobile-business-launch"
SOURCE_REL="skill/${SKILL_NAME}"
RUNTIME="${HOME}/.codex/skills/${SKILL_NAME}"
CONSUMER_LINKS=("${HOME}/.claude/skills/${SKILL_NAME}" "${HOME}/.agents/skills/${SKILL_NAME}")

DRY_RUN=0
DO_PULL=1
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-pull) DO_PULL=0 ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
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

# --- 1. Skip cleanly where there is no installed runtime ---------------------
if [ ! -d "$RUNTIME" ]; then
  echo "No installed runtime at ${RUNTIME}."
  echo "Runtime sync is maintainer-machine only; 'npm run audit:ci' is the readiness gate here."
  exit 0
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
npm install --silent
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
( cd "$RUNTIME" && npm install --silent && npm run audit )

# --- 6. Prove byte parity ----------------------------------------------------
step "Verifying parity"
if diff -qr -x node_modules -x .DS_Store "$SOURCE_REL" "$RUNTIME"; then
  echo "parity OK: source and runtime are byte-identical."
else
  fail "runtime drifted from source after sync (see diff above)"
fi

# --- 7. Verify the Claude/Agents consumers point at the Codex runtime --------
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

# --- 8. Freshness gate -------------------------------------------------------
step "Skill version freshness"
npm run check:skill-version --silent -- --source "$SOURCE_REL" --installed "$RUNTIME"

step "Runtime sync complete"
