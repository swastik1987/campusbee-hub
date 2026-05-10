import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider, useUser } from "@/contexts/UserContext";
import AuthGuard from "@/components/AuthGuard";
import { OAUTH_RETURN_KEY } from "@/components/AuthDrawer";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/seeker/Onboarding";
import Explore from "./pages/seeker/Explore";
import MyClasses from "./pages/seeker/MyClasses";
import ClassDetail from "./pages/seeker/ClassDetail";
import ProviderProfilePage from "./pages/seeker/ProviderProfilePage";
import EnrollFlow from "./pages/seeker/EnrollFlow";
import EnrollmentDetail from "./pages/seeker/EnrollmentDetail";
import Chat from "./pages/seeker/Chat";
import Profile from "./pages/seeker/Profile";
import FamilyManagement from "./pages/seeker/FamilyManagement";
import InviteAccept from "./pages/seeker/InviteAccept";
import ProviderDashboard from "./pages/provider/ProviderDashboard";
import ProviderClasses from "./pages/provider/ProviderClasses";
import ProviderClassDetail from "./pages/provider/ProviderClassDetail";
import CreateClass from "./pages/provider/CreateClass";
import CreateBatch from "./pages/provider/CreateBatch";
import BecomeProvider from "./pages/provider/BecomeProvider";
import TrainerManagement from "./pages/provider/TrainerManagement";
import ProviderStudents from "./pages/provider/ProviderStudents";
import ProviderPayments from "./pages/provider/ProviderPayments";
import TakeAttendance from "./pages/provider/TakeAttendance";
import Announcements from "./pages/provider/Announcements";
import ProviderAnalytics from "./pages/provider/ProviderAnalytics";
import ProviderMaterials from "./pages/provider/ProviderMaterials";
import ProviderDemoSessions from "./pages/provider/ProviderDemoSessions";
import ProviderReviews from "./pages/provider/ProviderReviews";
import ProviderSubscription from "./pages/provider/ProviderSubscription";
import ProviderCategories from "./pages/provider/ProviderCategories";
import Notifications from "./pages/Notifications";
import PlatformLayout from "./pages/platform/PlatformLayout";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import PlatformCategories from "./pages/platform/PlatformCategories";
import PlatformAnalytics from "./pages/platform/PlatformAnalytics";
import PlatformModeration from "./pages/platform/PlatformModeration";
import PlatformSubscriptions from "./pages/platform/PlatformSubscriptions";
import PlatformSponsored from "./pages/platform/PlatformSponsored";
import PlatformProviders from "./pages/platform/PlatformProviders";
import PlatformSettings from "./pages/platform/PlatformSettings";
import NotFound from "./pages/NotFound";

/**
 * After an OAuth full-redirect the browser lands on window.location.origin (/).
 * This handler watches for session + profile to become available and navigates
 * back to wherever the user started the OAuth flow (saved to localStorage in
 * AuthDrawer before triggering the redirect).
 *
 * If OAuth used a popup (no page redirect) and the user is already on the
 * correct page, the paths match so no navigation fires — just cleanup.
 */
const OAuthReturnHandler = () => {
  const { session, profile } = useUser();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!session || !profile) return;
    const returnTo = localStorage.getItem(OAUTH_RETURN_KEY);
    if (returnTo && returnTo.startsWith("/")) {
      localStorage.removeItem(OAUTH_RETURN_KEY);
      if (window.location.pathname + window.location.search !== returnTo) {
        navigate(returnTo, { replace: true });
      }
    }
  }, [session, profile, navigate]);

  return null;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UserProvider>
          {/* Handles post-OAuth redirect back to the originating page */}
          <OAuthReturnHandler />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />

            {/* Public class detail — no AuthGuard; anonymous visitors allowed */}
            <Route path="/class/:classId" element={<ClassDetail />} />

            {/* Protected seeker routes */}
            <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
            <Route path="/explore" element={<AuthGuard><Explore /></AuthGuard>} />
            <Route path="/my-classes" element={<AuthGuard><MyClasses /></AuthGuard>} />
            <Route path="/provider-profile/:providerId" element={<AuthGuard><ProviderProfilePage /></AuthGuard>} />
            <Route path="/enroll/:batchId" element={<AuthGuard><EnrollFlow /></AuthGuard>} />
            <Route path="/enrollment/:enrollmentId" element={<AuthGuard><EnrollmentDetail /></AuthGuard>} />
            <Route path="/chat" element={<AuthGuard><Chat /></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
            <Route path="/family" element={<AuthGuard><FamilyManagement /></AuthGuard>} />
            <Route path="/invite/:inviteCode" element={<InviteAccept />} />

            {/* Protected provider routes */}
            <Route path="/become-provider" element={<AuthGuard><BecomeProvider /></AuthGuard>} />
            <Route path="/provider/dashboard" element={<AuthGuard><ProviderDashboard /></AuthGuard>} />
            <Route path="/provider/classes" element={<AuthGuard><ProviderClasses /></AuthGuard>} />
            <Route path="/provider/classes/new" element={<AuthGuard><CreateClass /></AuthGuard>} />
            <Route path="/provider/classes/:classId" element={<AuthGuard><ProviderClassDetail /></AuthGuard>} />
            <Route path="/provider/classes/:classId/batch/new" element={<AuthGuard><CreateBatch /></AuthGuard>} />
            <Route path="/provider/trainers" element={<AuthGuard><TrainerManagement /></AuthGuard>} />
            <Route path="/provider/students" element={<AuthGuard><ProviderStudents /></AuthGuard>} />
            <Route path="/provider/payments" element={<AuthGuard><ProviderPayments /></AuthGuard>} />
            <Route path="/provider/attendance/:batchId" element={<AuthGuard><TakeAttendance /></AuthGuard>} />
            <Route path="/provider/announcements" element={<AuthGuard><Announcements /></AuthGuard>} />
            <Route path="/provider/analytics" element={<AuthGuard><ProviderAnalytics /></AuthGuard>} />
            <Route path="/provider/classes/:classId/materials" element={<AuthGuard><ProviderMaterials /></AuthGuard>} />
            <Route path="/provider/classes/:classId/demos" element={<AuthGuard><ProviderDemoSessions /></AuthGuard>} />
            <Route path="/provider/reviews" element={<AuthGuard><ProviderReviews /></AuthGuard>} />
            <Route path="/provider/subscription" element={<AuthGuard><ProviderSubscription /></AuthGuard>} />
            <Route path="/provider/categories" element={<AuthGuard><ProviderCategories /></AuthGuard>} />

            {/* Notifications */}
            <Route path="/notifications" element={<AuthGuard><Notifications /></AuthGuard>} />

            {/* v2: /admin/* routes removed entirely (Apartment Admin role gone). */}
            <Route path="/admin/*" element={<Navigate to="/" replace />} />

            {/* Platform admin routes (nested layout) */}
            <Route path="/platform" element={<AuthGuard><PlatformLayout /></AuthGuard>}>
              <Route index element={<PlatformDashboard />} />
              <Route path="moderation" element={<PlatformModeration />} />
              <Route path="subscriptions" element={<PlatformSubscriptions />} />
              <Route path="sponsored" element={<PlatformSponsored />} />
              <Route path="providers" element={<PlatformProviders />} />
              <Route path="categories" element={<PlatformCategories />} />
              <Route path="analytics" element={<PlatformAnalytics />} />
              <Route path="settings" element={<PlatformSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </UserProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
