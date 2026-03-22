import { useLocation, useNavigate } from "react-router-dom";
import { Home, Search, BookOpen, MessageCircle, User, LayoutDashboard, Users, Wallet } from "lucide-react";

type Persona = "seeker" | "provider";

const seekerTabs = [
  { path: "/home", icon: Home, label: "Home" },
  { path: "/explore", icon: Search, label: "Explore" },
  { path: "/my-classes", icon: BookOpen, label: "Classes" },
  { path: "/chat", icon: MessageCircle, label: "Chat" },
  { path: "/profile", icon: User, label: "Profile" },
];

const providerTabs = [
  { path: "/provider/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/provider/classes", icon: BookOpen, label: "Classes" },
  { path: "/provider/students", icon: Users, label: "Students" },
  { path: "/provider/payments", icon: Wallet, label: "Payments" },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = ({ persona = "seeker" }: { persona?: Persona }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = persona === "provider" ? providerTabs : seekerTabs;

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
                className={active ? "text-primary" : "text-muted-foreground"}
                fill={active ? "hsl(var(--primary))" : "none"}
                strokeWidth={active ? 2.2 : 1.8}
              />
              {active && (
                <span className="text-[10px] font-semibold text-primary leading-none">
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
