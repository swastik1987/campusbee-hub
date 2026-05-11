import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import PersonaSwitcher from "./PersonaSwitcher";
import { Bell, Home, MessageCircle, User } from "lucide-react";

interface HeaderProps {
  showPersonaSwitcher?: boolean;
}

/**
 * v2 header: shows the seeker's home address (or first line of it) instead
 * of the v1 apartment name. Falls back to nothing when location not set.
 */
const Header = React.forwardRef<HTMLElement, HeaderProps>(
  ({ showPersonaSwitcher = true }, ref) => {
    const { profile } = useUser();
    const navigate = useNavigate();
    const location = useLocation();
    const { data: unreadCount } = useUnreadNotificationCount(profile?.id);

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
            <button
              onClick={() => navigate("/")}
              className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-[oklch(0.78_0.18_250)] to-[oklch(0.62_0.20_250)] text-base font-extrabold text-white transition-opacity active:opacity-70"
              title="CampusBee Home"
            >
              C
            </button>
            {shouldShowPersonaSwitcher && <PersonaSwitcher />}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate("/")}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
              title="Home"
            >
              <Home size={18} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/chat")}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
              title="Chat"
            >
              <MessageCircle size={18} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/notifications")}
              className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
              title="Notifications"
            >
              <Bell size={18} className="text-muted-foreground" />
              {unreadCount && unreadCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
              title="Profile"
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
