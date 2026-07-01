import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { useStore } from "./store/useStore";
import AuthScreen from "./screens/AuthScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";

// Gate: run the auth check once, then show a loader, the login wall, the
// set-new-password screen (after a reset link), or the app.
export default function Root() {
  const authReady = useStore((s) => s.authReady);
  const user = useStore((s) => s.user);
  const localMode = useStore((s) => s.localMode);
  const recovering = useStore((s) => s.recovering);

  useEffect(() => {
    useStore.getState().initAuth();
  }, []);

  if (!authReady) {
    return <div className="authwrap"><div className="authloading">Loading…</div></div>;
  }
  if (recovering) {
    return <ResetPasswordScreen />;
  }
  if (!localMode && !user) {
    return <AuthScreen />;
  }
  return <RouterProvider router={router} />;
}
