import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useUnreadChatCount } from "@/hooks/useEngagement";
import PersonaSwitcher from "./PersonaSwitcher";
import { Badge } from "@/components/ui/badge";
import { Bell, Home, MessageCircle, User, UserCheck } from "lucide-react";

interface HeaderProps {
  showPersonaSwitcher?: boolean;
}

/**
 * v2 header: shows the seeker's home address (or first line of it) instead
 * of the v1 apartment name. Falls back to nothing when location not set.
 */
const Header = React.forwardRef<HTMLElement, HeaderProps>(
  ({ showPersonaSwitcher = true }, ref) => {
    const { profile, isCoach, activePersona } = useUser();
    const navigate = useNavigate();
    const location = useLocation();
    const { data: unreadCount } = useUnreadNotificationCount(profile?.id);
    const { data: unreadChatCount } = useUnreadChatCount(profile?.id);

    const hidePersonaSwitcherOnRoutes = new Set([
      "/profile",
      "/family",
      "/chat",
      "/notifications",
    ]);
    const shouldShowPersonaSwitcher =
      showPersonaSwitcher && !hidePersonaSwitcherOnRoutes.has(location.pathname);

    return (
      <header
        ref={ref}
        className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      >
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* 44px hit area around the 32px logo tile */}
            <button
              onClick={() => navigate("/")}
              className="flex h-11 w-11 -ml-1.5 items-center justify-center transition-opacity active:opacity-70"
              title="CampusBee Home"
              aria-label="CampusBee Home"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-[oklch(0.78_0.18_250)] to-[oklch(0.62_0.20_250)] text-base font-extrabold text-white">
                C
              </span>
            </button>
            {shouldShowPersonaSwitcher && <PersonaSwitcher />}
            {isCoach && activePersona === "provider" && (
              <Badge
                className="ml-1 gap-1 border-0 bg-indigo-100 text-[10px] text-indigo-700"
                title="You have Coach access"
              >
                <UserCheck size={10} />
                Coach
              </Badge>
            )}
          </div>

          {/* 44px touch targets (h-11 w-11) per mobile-first guideline */}
          <div className="flex items-center">
            <button
              onClick={() => navigate("/")}
              className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-accent"
              title="Home"
              aria-label="Home"
            >
              <Home size={18} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/chat")}
              className="relative flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-accent"
              title="Chat"
              aria-label={
                unreadChatCount && unreadChatCount > 0
                  ? `Chat, ${unreadChatCount} unread`
                  : "Chat"
              }
            >
              <MessageCircle size={18} className="text-muted-foreground" />
              {unreadChatCount && unreadChatCount > 0 ? (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {unreadChatCount > 9 ? "9+" : unreadChatCount}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => navigate("/notifications")}
              className="relative flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-accent"
              title="Notifications"
              aria-label={
                unreadCount && unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
            >
              <Bell size={18} className="text-muted-foreground" />
              {unreadCount && unreadCount > 0 ? (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-accent"
              title="Profile"
              aria-label="Profile"
            >
              <User size={18} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>
    );
  }
);

Header.displayName = "Header";

export default Header;
