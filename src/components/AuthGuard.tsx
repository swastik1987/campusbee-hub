import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";

// Routes accessible without completing onboarding (any authenticated user)
const ONBOARDING_EXEMPT_ROUTES = ["/onboarding", "/profile", "/notifications", "/become-provider"];

// Routes that require platform-admin role. (v1's /admin/* removed entirely.)
const ADMIN_ROUTES = ["/platform"];

// Provider routes — require provider profile, not family setup
const PROVIDER_ROUTES_PREFIX = "/provider/";

// Routes that require a completed onboarding (family setup)
// i.e., seeker routes that depend on family/location context
const REQUIRES_FAMILY_PREFIXES = [
  "/explore", "/my-classes", "/enroll/",
  "/enrollment/", "/chat", "/family",
  "/provider-profile/",
];

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, family, profile, isCoach } = useUser();
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

  // Not logged in → auth page
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Session present but profile hasn't finished hydrating yet — keep the loading
  // splash up instead of falsely redirecting. The auth-state callback flips
  // `loading=false` before `fetchOrCreateProfile` resolves, which used to make
  // protected routes bounce to "/" on first paint.
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo-icon.png" alt="CampusBee" className="h-12 w-12 object-contain animate-fade-in" />
          <p className="text-muted-foreground text-sm animate-fade-up">Loading...</p>
        </div>
      </div>
    );
  }

  const path = location.pathname;

  // Always allow onboarding-exempt routes for any authenticated user
  if (ONBOARDING_EXEMPT_ROUTES.some((r) => path.startsWith(r))) {
    return <>{children}</>;
  }

  // Platform admin routes
  if (ADMIN_ROUTES.some((r) => path.startsWith(r))) {
    if (profile.is_platform_admin) {
      return <>{children}</>;
    }
    return <Navigate to="/" replace />;
  }

  // Provider routes: academy admins (is_provider) AND coaches (linked via the
  // coaches table) can access. Coaches don't own a service_providers row but
  // legitimately need /provider/dashboard, /provider/attendance/:batchId,
  // /provider/payments, etc. for their assigned scope.
  const canAccessProvider = profile.is_provider || isCoach;
  if (path.startsWith(PROVIDER_ROUTES_PREFIX) || (path.startsWith("/chat") && canAccessProvider)) {
    if (canAccessProvider) {
      return <>{children}</>;
    }
    return <Navigate to="/" replace />;
  }

  // For routes that require family context, redirect to landing hub
  // (which shows the "Complete Your Setup" card) if onboarding isn't done
  if (!family && REQUIRES_FAMILY_PREFIXES.some((r) => path.startsWith(r))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
