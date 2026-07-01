import { useState } from "react";
import { useStore } from "../store/useStore";

// Login / registration wall shown when Supabase is configured and no user is
// signed in. Each account's transactions & settings are private (row-level
// security), so this is what makes the dashboard multi-user.
export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");

  const signIn = useStore((s) => s.signIn);
  const signUp = useStore((s) => s.signUp);
  const authBusy = useStore((s) => s.authBusy);
  const authError = useStore((s) => s.authError);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice("");
    if (mode === "login") {
      await signIn(email, password);
    } else {
      await signUp(email, password);
      // If email confirmation is enabled there won't be a session yet.
      if (!useStore.getState().authError && !useStore.getState().user) {
        setNotice("Account created. If email confirmation is on, check your inbox — otherwise sign in below.");
        setMode("login");
      }
    }
  };

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={submit}>
        <img src="/inderes-logo-blue.png" alt="inderes" className="authlogo" onError={(ev) => ((ev.target as HTMLImageElement).style.display = "none")} />
        <div className="authttl">{mode === "login" ? "Sign in to your portfolio" : "Create your account"}</div>
        <div className="authsub">
          Your holdings, transactions and analysis are private to your account.
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

        {authError && <div className="autherr">{authError}</div>}
        {notice && <div className="authnote">{notice}</div>}

        <button className="authbtn" type="submit" disabled={authBusy}>
          {authBusy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <div className="authswitch">
          {mode === "login" ? (
            <>New here? <button type="button" onClick={() => { setMode("register"); setNotice(""); }}>Create an account</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => { setMode("login"); setNotice(""); }}>Sign in</button></>
          )}
        </div>
      </form>
    </div>
  );
}
