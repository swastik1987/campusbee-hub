import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, isNewUser, family } = useUser();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl animate-fade-in">🐝</span>
          <p className="text-muted-foreground text-sm animate-fade-up">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect new users or users without a family to onboarding
  // (unless they're already on the onboarding page)
  if ((isNewUser || !family) && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
