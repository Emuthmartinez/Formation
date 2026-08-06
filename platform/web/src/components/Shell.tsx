import { useState, type ReactNode } from "react";
import type { SessionPayload, Workspace, WorkspaceSummary } from "../types";
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
];

export function Shell({
  session,
  workspace,
  workspaces,
  currentPath,
  onWorkspaceChange,
  onLogout,
  children,
}: {
  session: SessionPayload;
  workspace: Workspace;
  workspaces: WorkspaceSummary[];
  currentPath: string;
  onWorkspaceChange: (workspaceId: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
              <button
                key={item.path}
                className={`nav-item ${active ? "nav-item--active" : ""}`}
                onClick={() => go(item.path)}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={item.icon} width={19} height={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <span className="avatar">{initials(session.user.name)}</span>
            <div>
              <strong>{session.user.name}</strong>
              <span>{session.user.email}</span>
            </div>
          </div>
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
            <span>{humanize(workspace.stage)}</span>
            <span aria-hidden="true">·</span>
            <span>{workspace.company.currentGoal}</span>
          </div>
          <Button variant="quiet" icon="plus" onClick={() => go("/decisions?new=1")}>
            Record decision
          </Button>
        </header>
        <main className="main-content">{children}</main>
      </div>
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
