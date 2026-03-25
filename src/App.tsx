import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/contexts/UserContext";
import AuthGuard from "@/components/AuthGuard";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/seeker/Onboarding";
import SeekerHome from "./pages/seeker/SeekerHome";
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
import ProviderTerms from "./pages/provider/ProviderTerms";
import Notifications from "./pages/Notifications";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProviders from "./pages/admin/AdminProviders";
import AdminProviderDetail from "./pages/admin/AdminProviderDetail";
import AdminReports from "./pages/admin/AdminReports";
import AdminFeatured from "./pages/admin/AdminFeatured";
import PlatformLayout from "./pages/platform/PlatformLayout";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import PlatformApartments from "./pages/platform/PlatformApartments";
import PlatformCategories from "./pages/platform/PlatformCategories";
import PlatformAnalytics from "./pages/platform/PlatformAnalytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UserProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />

            {/* Protected seeker routes */}
            <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
            <Route path="/home" element={<AuthGuard><SeekerHome /></AuthGuard>} />
            <Route path="/explore" element={<AuthGuard><Explore /></AuthGuard>} />
            <Route path="/my-classes" element={<AuthGuard><MyClasses /></AuthGuard>} />
            <Route path="/class/:classId" element={<AuthGuard><ClassDetail /></AuthGuard>} />
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
            <Route path="/provider/terms" element={<AuthGuard><ProviderTerms /></AuthGuard>} />

            {/* Notifications */}
            <Route path="/notifications" element={<AuthGuard><Notifications /></AuthGuard>} />

            {/* Protected admin routes */}
            <Route path="/admin/dashboard" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
            <Route path="/admin/providers" element={<AuthGuard><AdminProviders /></AuthGuard>} />
            <Route path="/admin/providers/:registrationId" element={<AuthGuard><AdminProviderDetail /></AuthGuard>} />
            <Route path="/admin/reports" element={<AuthGuard><AdminReports /></AuthGuard>} />
            <Route path="/admin/featured" element={<AuthGuard><AdminFeatured /></AuthGuard>} />

            {/* Platform admin routes (nested layout) */}
            <Route path="/platform" element={<AuthGuard><PlatformLayout /></AuthGuard>}>
              <Route index element={<PlatformDashboard />} />
              <Route path="apartments" element={<PlatformApartments />} />
              <Route path="categories" element={<PlatformCategories />} />
              <Route path="analytics" element={<PlatformAnalytics />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </UserProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
