import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Search,
  BookOpen,
  MessageCircle,
  User,
  LayoutDashboard,
  Users,
  Wallet,
  BarChart3,
  FolderTree,
  ShieldCheck,
} from "lucide-react";

type Persona = "seeker" | "provider" | "platform_admin";
type NavTab = { path: string; activePaths: string[]; icon: typeof Home; label: string };

const seekerTabs = [
  // Home navigates to "/" (contextual landing). Active on both "/" and "/home"
  // because Landing auto-redirects single-role seekers to /home.
  { path: "/", activePaths: ["/", "/home"], icon: Home, label: "Home" },
  { path: "/explore",    activePaths: ["/explore"],    icon: Search,        label: "Explore"  },
  { path: "/my-classes", activePaths: ["/my-classes"], icon: BookOpen,      label: "Classes"  },
  { path: "/chat",       activePaths: ["/chat"],       icon: MessageCircle, label: "Chat"     },
  { path: "/profile",    activePaths: ["/profile"],    icon: User,          label: "Profile"  },
];

const providerTabs = [
  { path: "/provider/dashboard", activePaths: ["/provider/dashboard"], icon: LayoutDashboard, label: "Dashboard" },
  { path: "/provider/classes",   activePaths: ["/provider/classes"],   icon: BookOpen,        label: "Classes"   },
  { path: "/provider/students",  activePaths: ["/provider/students"],  icon: Users,           label: "Students"  },
  { path: "/chat",               activePaths: ["/chat"],               icon: MessageCircle,   label: "Chat"      },
  { path: "/provider/payments",  activePaths: ["/provider/payments"],  icon: Wallet,          label: "Payments"  },
];

// v2 Platform Admin: apartments tab removed, moderation tab added
const platformAdminTabs = [
  { path: "/platform",            activePaths: ["/platform"],            icon: LayoutDashboard, label: "Dashboard"  },
  { path: "/platform/moderation", activePaths: ["/platform/moderation"], icon: ShieldCheck,     label: "Review"     },
  { path: "/platform/categories", activePaths: ["/platform/categories"], icon: FolderTree,      label: "Categories" },
  { path: "/platform/analytics",  activePaths: ["/platform/analytics"],  icon: BarChart3,       label: "Analytics"  },
  { path: "/profile",             activePaths: ["/profile"],             icon: User,            label: "Profile"    },
];

const BottomNav = React.forwardRef<HTMLElement, { persona?: Persona }>(
  ({ persona = "seeker" }, ref) => {
    const location = useLocation();
    const navigate = useNavigate();

    const tabs: NavTab[] =
      persona === "platform_admin"
        ? platformAdminTabs
        : persona === "provider"
        ? providerTabs
        : seekerTabs;

    const accentColor =
      persona === "platform_admin"
        ? "hsl(215, 20%, 35%)" // slate
        : persona === "provider"
        ? "hsl(239, 84%, 67%)" // indigo
        : "hsl(245, 65%, 55%)";

    return (
      <nav
        ref={ref}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card safe-bottom"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {tabs.map((tab) => {
            const active = tab.activePaths.some((p) => location.pathname === p);
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
  }
);

BottomNav.displayName = "BottomNav";

export default BottomNav;
