import { useState } from "react";
import { useStore } from "../store/useStore";

// Shown after the user clicks the password-reset link in their email (Supabase
// establishes a recovery session and fires PASSWORD_RECOVERY → store.recovering).
export default function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localErr, setLocalErr] = useState("");

  const updatePassword = useStore((s) => s.updatePassword);
  const authBusy = useStore((s) => s.authBusy);
  const authError = useStore((s) => s.authError);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr("");
    if (password.length < 6) { setLocalErr("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setLocalErr("Passwords don't match."); return; }
    await updatePassword(password);
    // on success store.recovering flips to false and the app renders
  };

  return (
    <div className="authwrap">
      <form className="authcard" onSubmit={submit}>
        <div className="authttl">Set a new password</div>
        <div className="authsub">Choose a new password for your account.</div>

        <label className="authlbl">New password</label>
        <input className="authin" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />

        <label className="authlbl">Confirm new password</label>
        <input className="authin" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required />

        {(localErr || authError) && <div className="autherr">{localErr || authError}</div>}

        <button className="authbtn" type="submit" disabled={authBusy}>
          {authBusy ? "…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
