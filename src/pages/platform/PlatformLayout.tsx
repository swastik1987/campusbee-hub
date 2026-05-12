import { useLocation, useNavigate, Outlet } from "react-router-dom";
import {
  BarChart3,
  Crown,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  ShieldAlert,
  UserCog,
  Users,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";

const navItems = [
  { path: "/platform",               icon: LayoutDashboard, label: "Dashboard"     },
  { path: "/platform/moderation",    icon: ShieldAlert,     label: "Moderation"    },
  { path: "/platform/subscriptions", icon: Crown,           label: "Subscriptions" },
  { path: "/platform/sponsored",     icon: Megaphone,       label: "Sponsored"     },
  { path: "/platform/providers",     icon: Users,           label: "Instructors"     },
  { path: "/platform/categories",    icon: FolderTree,      label: "Categories"    },
  { path: "/platform/analytics",     icon: BarChart3,       label: "Analytics"     },
  { path: "/platform/settings",      icon: Settings,        label: "Settings"      },
];

const PlatformLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUser();

  const isActive = (path: string) =>
    path === "/platform"
      ? location.pathname === "/platform"
      : location.pathname.startsWith(path);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — hidden on mobile, visible on md+ */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card p-4">
        <div className="flex items-center gap-2 px-2 mb-6">
          <img src="/logo-icon.png" alt="CampusBee" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="text-sm font-bold gradient-primary-text">CampusBee</h1>
            <p className="text-[10px] text-muted-foreground">Platform Admin</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t pt-3 mt-3 space-y-1">
          <div className="flex items-center gap-2 px-2 mb-1">
            <UserCog size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate">{profile?.full_name}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-muted-foreground"
            onClick={() => { supabase.auth.signOut(); navigate("/"); }}
          >
            <LogOut size={14} /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile: top nav */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-40 border-b border-border bg-card px-4">
          <div className="flex h-12 items-center gap-2">
            <img src="/logo-icon.png" alt="CampusBee" className="h-7 w-7 object-contain" />
            <span className="text-sm font-bold gradient-primary-text">CampusBee Admin</span>
          </div>
          <div className="flex gap-1.5 pb-2 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <item.icon size={13} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6 lg:p-8 max-w-6xl mx-auto w-full">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <div className="md:hidden">
          <BottomNav persona="platform_admin" />
        </div>
      </div>
    </div>
  );
};

export default PlatformLayout;
