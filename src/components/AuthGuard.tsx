import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";

// Routes accessible without completing onboarding (any authenticated user)
const ONBOARDING_EXEMPT_ROUTES = ["/onboarding", "/profile", "/notifications"];

// Routes that specifically require admin roles (but not family/onboarding)
const ADMIN_ROUTES = ["/platform", "/admin"];

// Provider routes — require provider profile, not family setup
const PROVIDER_ROUTES_PREFIX = "/provider/";

// Routes that require a completed onboarding (family setup)
// i.e., seeker routes that depend on apartment context
const REQUIRES_FAMILY_PREFIXES = [
  "/home", "/explore", "/my-classes", "/class/", "/enroll/",
  "/enrollment/", "/chat", "/family", "/become-provider",
  "/provider-profile/",
];

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, family, profile } = useUser();
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

  const path = location.pathname;

  // Always allow onboarding-exempt routes for any authenticated user
  if (ONBOARDING_EXEMPT_ROUTES.some((r) => path.startsWith(r))) {
    return <>{children}</>;
  }

  // Allow admin routes for users with matching admin roles
  if (ADMIN_ROUTES.some((r) => path.startsWith(r))) {
    const isAdmin = profile?.is_platform_admin || profile?.is_apartment_admin;
    if (isAdmin) {
      return <>{children}</>;
    }
    // Non-admin trying to access admin route → redirect to landing
    return <Navigate to="/" replace />;
  }

  // Allow provider routes for users with provider profile (no family required)
  if (path.startsWith(PROVIDER_ROUTES_PREFIX)) {
    if (profile?.is_provider) {
      return <>{children}</>;
    }
    return <Navigate to="/" replace />;
  }

  // Allow /become-provider for existing providers (re-apply after rejection)
  if (path === "/become-provider" && profile?.is_provider) {
    return <>{children}</>;
  }

  // For routes that require family/apartment context, redirect to landing hub
  // (which shows the "Complete Your Setup" card) if onboarding isn't done
  if (!family && REQUIRES_FAMILY_PREFIXES.some((r) => path.startsWith(r))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
