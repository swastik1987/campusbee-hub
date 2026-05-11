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
  { path: "/", activePaths: ["/"], icon: Home, label: "Home" },
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
  (_props, _ref) => null
);

BottomNav.displayName = "BottomNav";

export default BottomNav;
