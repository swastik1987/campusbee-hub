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
import Chat from "./pages/seeker/Chat";
import Profile from "./pages/seeker/Profile";
import ProviderDashboard from "./pages/provider/ProviderDashboard";
import ProviderClasses from "./pages/provider/ProviderClasses";
import ProviderStudents from "./pages/provider/ProviderStudents";
import ProviderPayments from "./pages/provider/ProviderPayments";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProviders from "./pages/admin/AdminProviders";
import AdminReports from "./pages/admin/AdminReports";
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
            <Route path="/chat" element={<AuthGuard><Chat /></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />

            {/* Protected provider routes */}
            <Route path="/provider/dashboard" element={<AuthGuard><ProviderDashboard /></AuthGuard>} />
            <Route path="/provider/classes" element={<AuthGuard><ProviderClasses /></AuthGuard>} />
            <Route path="/provider/students" element={<AuthGuard><ProviderStudents /></AuthGuard>} />
            <Route path="/provider/payments" element={<AuthGuard><ProviderPayments /></AuthGuard>} />

            {/* Protected admin routes */}
            <Route path="/admin/dashboard" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
            <Route path="/admin/providers" element={<AuthGuard><AdminProviders /></AuthGuard>} />
            <Route path="/admin/reports" element={<AuthGuard><AdminReports /></AuthGuard>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </UserProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
