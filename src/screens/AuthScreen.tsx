import { useState } from "react";
import { useStore } from "../store/useStore";

type Mode = "login" | "register" | "forgot";

// Login / registration / forgot-password wall shown when Supabase is configured
// and no user is signed in. Each account's data is private (row-level security).
export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signIn = useStore((s) => s.signIn);
  const signUp = useStore((s) => s.signUp);
  const resetPassword = useStore((s) => s.resetPassword);
  const authBusy = useStore((s) => s.authBusy);
  const authError = useStore((s) => s.authError);
  const authNotice = useStore((s) => s.authNotice);

  const go = (m: Mode) => {
    setMode(m);
    // clear any lingering error/notice when switching modes
    useStore.setState({ authError: null, authNotice: null });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      await signIn(email, password);
    } else if (mode === "register") {
      await signUp(email, password);
      if (!useStore.getState().authError && !useStore.getState().user) {
        useStore.setState({ authNotice: "Account created. If email confirmation is on, check your inbox — otherwise sign in below." });
        setMode("login");
      }
    } else {
      await resetPassword(email);
    }
  };

  const title = mode === "login" ? "Sign in to your portfolio" : mode === "register" ? "Create your account" : "Reset your password";
  const cta = authBusy ? "…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link";

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={submit}>
        <div className="authttl">{title}</div>
        <div className="authsub">
          {mode === "forgot"
            ? "Enter your email and we'll send you a link to set a new password."
            : "Your holdings, transactions and analysis are private to your account."}
        </div>

        <label className="authlbl">Email</label>
        <input
          className="authin"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {mode !== "forgot" && (
          <>
            <label className="authlbl">Password</label>
            <input
              className="authin"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </>
        )}

        {mode === "login" && (
          <button type="button" className="authlink authforgot" onClick={() => go("forgot")}>
            Forgot your password?
          </button>
        )}

        {authError && <div className="autherr">{authError}</div>}
        {authNotice && <div className="authnote">{authNotice}</div>}

        <button className="authbtn" type="submit" disabled={authBusy}>
          {cta}
        </button>

        <div className="authswitch">
          {mode === "login" && (
            <>New here? <button type="button" onClick={() => go("register")}>Create an account</button></>
          )}
          {mode === "register" && (
            <>Already have an account? <button type="button" onClick={() => go("login")}>Sign in</button></>
          )}
          {mode === "forgot" && (
            <>Remembered it? <button type="button" onClick={() => go("login")}>Back to sign in</button></>
          )}
        </div>
      </form>
    </div>
  );
}
