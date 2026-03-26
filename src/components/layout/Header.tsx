import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import PersonaSwitcher from "./PersonaSwitcher";
import { Bell, Home } from "lucide-react";

interface HeaderProps {
  showPersonaSwitcher?: boolean;
}

const Header = ({ showPersonaSwitcher = true }: HeaderProps) => {
  const { currentApartment, profile } = useUser();
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadNotificationCount(profile?.id);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        {/* Logo + Apartment — clickable to home */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 transition-opacity active:opacity-70"
        >
          <img src="/logo-icon.png" alt="CampusBee" className="h-8 w-8 object-contain" />
          <div className="leading-tight text-left">
            <h1 className="text-sm font-extrabold gradient-primary-text">
              CampusBee
            </h1>
            {currentApartment && (
              <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                {currentApartment.name}
              </p>
            )}
          </div>
        </button>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
            title="Home"
          >
            <Home size={18} className="text-muted-foreground" />
          </button>
          {showPersonaSwitcher && <PersonaSwitcher />}
          <button
            onClick={() => navigate("/notifications")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
          >
            <Bell size={18} className="text-muted-foreground" />
            {unreadCount && unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
