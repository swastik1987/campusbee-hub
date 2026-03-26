import { useLocation, useNavigate } from "react-router-dom";
import { Search, BookOpen, MessageCircle, User, LayoutDashboard, Users, Wallet, FileBarChart, Shield, Building2, BarChart3, FolderTree } from "lucide-react";

type Persona = "seeker" | "provider" | "admin" | "platform_admin";

const seekerTabs = [
  { path: "/explore", icon: Search, label: "Explore" },
  { path: "/my-classes", icon: BookOpen, label: "Classes" },
  { path: "/chat", icon: MessageCircle, label: "Chat" },
  { path: "/profile", icon: User, label: "Profile" },
];

const providerTabs = [
  { path: "/provider/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/provider/classes", icon: BookOpen, label: "Classes" },
  { path: "/provider/students", icon: Users, label: "Students" },
  { path: "/chat", icon: MessageCircle, label: "Chat" },
  { path: "/provider/payments", icon: Wallet, label: "Payments" },
];

const adminTabs = [
  { path: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/admin/providers", icon: Users, label: "Providers" },
  { path: "/admin/reports", icon: FileBarChart, label: "Reports" },
  { path: "/profile", icon: User, label: "Profile" },
];

const platformAdminTabs = [
  { path: "/platform", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/platform/apartments", icon: Building2, label: "Apartments" },
  { path: "/platform/categories", icon: FolderTree, label: "Categories" },
  { path: "/platform/analytics", icon: BarChart3, label: "Analytics" },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = ({ persona = "seeker" }: { persona?: Persona }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = persona === "platform_admin"
    ? platformAdminTabs
    : persona === "admin"
    ? adminTabs
    : persona === "provider"
    ? providerTabs
    : seekerTabs;

  const accentColor = persona === "platform_admin"
    ? "hsl(160, 84%, 39%)"
    : persona === "admin"
    ? "hsl(240, 60%, 60%)"
    : persona === "provider"
    ? "hsl(239, 84%, 67%)"
    : "hsl(var(--primary))";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors active:scale-95"
            >
              <tab.icon
                size={22}
                className={active ? "" : "text-muted-foreground"}
                style={active ? { color: accentColor } : undefined}
                fill={active ? accentColor : "none"}
                strokeWidth={active ? 2.2 : 1.8}
              />
              {active && (
                <span
                  className="text-[10px] font-semibold leading-none"
                  style={{ color: accentColor }}
                >
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
