import { Navigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useUser();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl animate-fade-in">🐝</span>
          <p className="text-muted-foreground text-sm animate-fade-up">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
