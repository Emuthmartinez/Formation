import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "./api";
import { Shell } from "./components/Shell";
import { ErrorNotice, Toast } from "./components/Primitives";
import { WorkspaceProvider } from "./context";
import { navigate, useRoute } from "./router";
import type { SessionPayload, WorkspaceSnapshot } from "./types";
import { BusinessPage } from "./pages/BusinessPage";
import { DecisionsPage } from "./pages/DecisionsPage";
import { DeliverablesPage } from "./pages/DeliverablesPage";
import { AccountPage } from "./pages/AccountPage";
import { JoinPage } from "./pages/JoinPage";
import { PeoplePage } from "./pages/PeoplePage";
import { LaunchPage } from "./pages/LaunchPage";
import { NewWorkspacePage } from "./pages/NewWorkspacePage";
import { SignInPage } from "./pages/SignInPage";
import { TodayPage } from "./pages/TodayPage";
import { WorkstreamDetailPage, WorkstreamsOverviewPage } from "./pages/WorkstreamsPage";

const ACTIVE_WORKSPACE_KEY = "formation.activeWorkspace";

export function App() {
  const route = useRoute();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => localStorage.getItem(ACTIVE_WORKSPACE_KEY));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const toastHeldRef = useRef(false);

  const notify = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    const tryDismiss = () => {
      // A held toast (hover or focus) stays until released; check again shortly after.
      if (toastHeldRef.current) {
        window.setTimeout(tryDismiss, 1_500);
        return;
      }
      setToast((current) => (current?.message === message ? null : current));
    };
    window.setTimeout(tryDismiss, 5_000);
  }, []);

  const toastElement = toast ? (
    <Toast
      {...toast}
      onDismiss={() => setToast(null)}
      onHoldChange={(held) => { toastHeldRef.current = held; }}
    />
  ) : null;

  const loadSession = useCallback(async () => {
    setError(null);
    try {
      const nextSession = await api.session();
      setSession(nextSession);
      const availableIds = new Set(nextSession.workspaces.map((workspace) => workspace.id));
      const nextId = activeWorkspaceId && availableIds.has(activeWorkspaceId)
        ? activeWorkspaceId
        : nextSession.workspaces[0]?.id ?? null;
      setActiveWorkspaceId(nextId);
      if (nextId) localStorage.setItem(ACTIVE_WORKSPACE_KEY, nextId);
      return { session: nextSession, workspaceId: nextId };
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setSession(null);
        setSnapshot(null);
        return { session: null, workspaceId: null };
      }
      throw caught;
    }
  }, [activeWorkspaceId]);

  const loadSnapshot = useCallback(async (workspaceId = activeWorkspaceId) => {
    if (!workspaceId) {
      setSnapshot(null);
      return;
    }
    const next = await api.workspace(workspaceId);
    setSnapshot(next);
  }, [activeWorkspaceId]);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadSession();
      if (result.workspaceId) await loadSnapshot(result.workspaceId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [loadSession, loadSnapshot]);

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setSession(null);
      setSnapshot(null);
      setError(null);
    };
    window.addEventListener("formation:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("formation:unauthorized", handleUnauthorized);
  }, []);

  const reload = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const nextSession = await api.session();
    setSession(nextSession);
    await loadSnapshot(activeWorkspaceId);
  }, [activeWorkspaceId, loadSnapshot]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    setLoading(true);
    try {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
      setActiveWorkspaceId(workspaceId);
      await loadSnapshot(workspaceId);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : String(caught), "error");
    } finally {
      setLoading(false);
    }
  }, [loadSnapshot, notify]);

  const onCreated = useCallback(async (workspaceId: string) => {
    const nextSession = await api.session();
    setSession(nextSession);
    await switchWorkspace(workspaceId);
  }, [switchWorkspace]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      setSession(null);
      setSnapshot(null);
      setActiveWorkspaceId(null);
    }
  }, []);

  const page = useMemo(() => {
    if (!snapshot) return null;
    const [first, second] = route.segments;
    if (!first) return <TodayPage />;
    if (first === "business") return <BusinessPage />;
    if (first === "workstreams" && second) return <WorkstreamDetailPage workstreamId={second} />;
    if (first === "workstreams") return <WorkstreamsOverviewPage />;
    if (first === "decisions") return <DecisionsPage openNew={route.query.get("new") === "1"} targetId={route.hash.slice(1)} />;
    if (first === "deliverables") return <DeliverablesPage artifactId={second} />;
    if (first === "launch") return <LaunchPage />;
    if (first === "people") return <PeoplePage />;
    if (first === "account") return <AccountPage />;
    if (first === "new") return <NewWorkspacePage onCreated={onCreated} />;
    return <TodayPage />;
  }, [route.path, route.query, route.hash, snapshot, onCreated]);

  // An invitation link is the one route a signed-out visitor is meant to reach. They are sent to
  // sign in carrying the token, so an instance with open registration closed still lets in the
  // person its owner invited.
  const invitationToken = route.segments[0] === "join" ? route.segments[1] : undefined;

  if (loading && !session) return <LoadingScreen />;
  if (!session) return <SignInPage onSignedIn={initialize} invitationToken={invitationToken} />;
  if (invitationToken) {
    return (
      <>
        <JoinPage
          token={invitationToken}
          onJoined={async (joinedWorkspaceId) => {
            await onCreated(joinedWorkspaceId);
            navigate("/");
          }}
        />
        {toastElement}
      </>
    );
  }
  if (error) return <main className="fatal-state"><ErrorNotice message={error} onRetry={initialize} /></main>;

  if (!snapshot) {
    return (
      <main className="standalone-new">
        <NewWorkspacePage onCreated={onCreated} />
        {toastElement}
      </main>
    );
  }

  return (
    <WorkspaceProvider value={{ session, snapshot, reload, notify }}>
      <Shell
        session={session}
        workspace={snapshot.workspace}
        workspaces={session.workspaces}
        role={snapshot.membership.role}
        capabilities={snapshot.capabilities}
        currentPath={route.path}
        onWorkspaceChange={switchWorkspace}
        onLogout={logout}
      >
        {loading ? <div className="page-loading"><span className="spinner" /> Updating workspace…</div> : page}
      </Shell>
      {toastElement}
    </WorkspaceProvider>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <div className="loading-screen__mark">F</div>
      <p>Opening Formation</p>
      <span className="spinner" />
    </main>
  );
}
