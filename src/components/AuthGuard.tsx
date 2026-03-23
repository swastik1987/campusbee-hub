import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";

// Routes that platform/apartment admins can access without completing onboarding
const ADMIN_BYPASS_ROUTES = ["/profile", "/platform", "/admin", "/notifications"];

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, isNewUser, family, profile } = useUser();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo-icon.png" alt="CampusBee" className="h-12 w-12 object-contain animate-fade-in" />
          <p className="text-muted-foreground text-sm animate-fade-up">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Allow admins to bypass onboarding for admin-specific routes
  const isAdmin = profile?.is_platform_admin || profile?.is_apartment_admin;
  const isAdminRoute = ADMIN_BYPASS_ROUTES.some((r) => location.pathname.startsWith(r));

  // Redirect new users or users without a family to onboarding
  // (unless they're already on the onboarding page or they're an admin accessing admin routes)
  if ((isNewUser || !family) && location.pathname !== "/onboarding" && !(isAdmin && isAdminRoute)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
