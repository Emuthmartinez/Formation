import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { Button, ErrorNotice, Field } from "../components/Primitives";
import type { PublicConfig } from "../types";

export function SignInPage({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.config().then(setConfig).catch(() => undefined);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") await api.register(name, email, password);
      else await api.login(email, password);
      await onSignedIn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const openDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.demoLogin();
      await onSignedIn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setError(null);
  };

  return (
    <main className="signin-page">
      <section className="signin-story">
        <div className="signin-story__brand"><span>F</span> Formation</div>
        <div className="signin-story__copy">
          <p className="eyebrow">Founder operating system</p>
          <h1>Build the business, not another pile of startup documents.</h1>
          <p>
            Formation turns your company context into decisions, working deliverables, and a clear path to launch.
            Every recommendation stays connected to the evidence and assumptions behind it.
          </p>
        </div>
        <p className="signin-story__note">From first thesis to a launch your team can actually execute.</p>
      </section>

      <section className="signin-panel">
        <div className="signin-panel__inner">
          <div className="signin-tabs" aria-label="Account access">
            <button
              className={mode === "login" ? "is-active" : ""}
              type="button"
              aria-pressed={mode === "login"}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            {config?.registrationEnabled !== false ? (
              <button
                className={mode === "register" ? "is-active" : ""}
                type="button"
                aria-pressed={mode === "register"}
                onClick={() => switchMode("register")}
              >
                Create account
              </button>
            ) : null}
          </div>

          <p className="eyebrow">{mode === "login" ? "Welcome back" : "Start a company workspace"}</p>
          <h2>{mode === "login" ? "Continue building" : "Create your Formation account"}</h2>
          <p>
            {mode === "login"
              ? "Return to the business context, decisions, and next actions your team has already built."
              : "Your first workspace starts with a guided business brief, not an empty dashboard."}
          </p>

          <form className="signin-form" onSubmit={submit}>
            {mode === "register" ? (
              <Field label="Your name">
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </Field>
            ) : null}
            <Field label="Work email">
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
              />
            </Field>
            <Field
              label="Password"
              hint={mode === "register" ? "Use 12 to 128 characters. Password managers are welcome here." : undefined}
            >
              <input
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={mode === "register" ? 12 : undefined}
                maxLength={128}
              />
            </Field>
            {error ? <ErrorNotice message={error} /> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Opening Formation…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {config?.demoAuthEnabled ? (
            <div className="signin-demo">
              <span>or explore the complete product</span>
              <Button type="button" variant="secondary" onClick={openDemo} disabled={busy}>
                Open Storywell demo
              </Button>
            </div>
          ) : null}

          <p className="signin-panel__security">
            Your workspace stays private. Access is re-checked before anyone can see or change your company’s work.
          </p>
        </div>
      </section>
    </main>
  );
}
