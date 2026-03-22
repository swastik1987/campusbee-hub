import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import PersonaSwitcher from "./PersonaSwitcher";
import { Bell } from "lucide-react";

interface HeaderProps {
  showPersonaSwitcher?: boolean;
}

const Header = ({ showPersonaSwitcher = true }: HeaderProps) => {
  const { currentApartment } = useUser();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        {/* Logo + Apartment */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐝</span>
          <div className="leading-tight">
            <h1 className="text-sm font-extrabold gradient-primary-text">
              CampusBee
            </h1>
            {currentApartment && (
              <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                {currentApartment.name}
              </p>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {showPersonaSwitcher && <PersonaSwitcher />}
          <button
            onClick={() => navigate("/notifications")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
          >
            <Bell size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
