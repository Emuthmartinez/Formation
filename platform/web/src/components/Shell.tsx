import { useState, type ReactNode } from "react";
import { accessSummary } from "../capabilities";
import type { Capability, SessionPayload, Workspace, WorkspaceSummary } from "../types";
import { navigate } from "../router";
import { Icon } from "./Icon";
import { Button, Select, humanize } from "./Primitives";

const primaryNavigation = [
  { label: "Today", path: "/", icon: "home" as const },
  { label: "Business", path: "/business", icon: "business" as const },
  { label: "Workstreams", path: "/workstreams", icon: "work" as const },
  { label: "Decisions", path: "/decisions", icon: "decision" as const },
  { label: "Deliverables", path: "/deliverables", icon: "document" as const },
  { label: "Launch", path: "/launch", icon: "launch" as const },
  { label: "People", path: "/people", icon: "business" as const },
];

// Mirrors the server's WORKSPACE_STAGES vocabulary (platform/server/validation.mjs).
const companyStages = ["idea", "discovery", "validation", "build", "beta", "launch", "growth"];

export function Shell({
  session,
  workspace,
  workspaces,
  role,
  capabilities,
  currentPath,
  onWorkspaceChange,
  onLogout,
  children,
}: {
  session: SessionPayload;
  workspace: Workspace;
  workspaces: WorkspaceSummary[];
  role: string;
  capabilities: Capability[];
  currentPath: string;
  onWorkspaceChange: (workspaceId: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const access = accessSummary(role, capabilities);

  const go = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__brand">
          <button className="wordmark" onClick={() => go("/")} aria-label="Formation home">
            <span className="wordmark__mark">F</span>
            <span>Formation</span>
          </button>
          <button className="icon-button sidebar__close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <Icon name="close" width={20} height={20} />
          </button>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-switcher__label">Company</span>
          <Select value={workspace.id} onChange={(event) => onWorkspaceChange(event.target.value)} aria-label="Choose company">
            {workspaces.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </Select>
          <StageProgress stage={workspace.stage} />
          <button className="workspace-switcher__new" onClick={() => go("/new")}>
            <Icon name="plus" width={15} height={15} /> New workspace
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Primary navigation">
          {primaryNavigation.map((item) => {
            const active = item.path === "/"
              ? currentPath === "/"
              : currentPath === item.path || currentPath.startsWith(`${item.path}/`);
            return (
              <a
                key={item.path}
                href={item.path}
                className={`nav-item ${active ? "nav-item--active" : ""}`}
                onClick={(event) => {
                  // Real hrefs keep open-in-new-tab and copy-link working; plain clicks stay in-app.
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  go(item.path);
                }}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={item.icon} width={19} height={19} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <button className="sidebar__user" onClick={() => go("/account")} aria-label="Your account and devices">
            <span className="avatar">{initials(session.user.name)}</span>
            <div>
              <strong>{session.user.name}</strong>
              <span>{session.user.email}</span>
            </div>
          </button>
          <button className="sidebar__logout" onClick={onLogout}>
            <Icon name="logout" width={17} height={17} /> Sign out
          </button>
        </div>
      </aside>

      {mobileOpen ? <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /> : null}

      <div className="app-frame">
        <header className="topbar">
          <button className="icon-button topbar__menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Icon name="menu" width={22} height={22} />
          </button>
          <div className="topbar__context">
            <strong>{humanize(workspace.stage)}</strong>
            <span className="topbar__divider" aria-hidden="true" />
            <span>{workspace.company.currentGoal}</span>
          </div>
          {capabilities.includes("decision-write") ? (
            <Button variant="quiet" icon="plus" onClick={() => go("/decisions?new=1")}>
              Record decision
            </Button>
          ) : null}
        </header>
        <main className="main-content">
          {/* Said once, plainly, rather than as a greyed-out control beside every action a
              member cannot take. A page of disabled buttons reads as a broken product. */}
          {access ? <p className="access-note">{access}</p> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Where the company sits on the road from idea to growth. The label carries the
 * information; the segments are a glanceable echo of it.
 */
function StageProgress({ stage }: { stage: string }) {
  const position = companyStages.indexOf(stage);
  if (position === -1) return null;
  return (
    <div className="workspace-stage">
      <span className="workspace-stage__label">
        <span>Stage</span>
        <strong>{humanize(stage)}</strong>
      </span>
      <span className="workspace-stage__segments" aria-hidden="true">
        {companyStages.map((entry, index) => (
          <span key={entry} className={index <= position ? "is-done" : ""} />
        ))}
      </span>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
