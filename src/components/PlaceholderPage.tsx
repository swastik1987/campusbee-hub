import { ArrowLeft, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";

type PlaceholderPageProps = {
  title: string;
  icon: LucideIcon;
  persona?: "seeker" | "provider" | "admin";
};

const PlaceholderPage = ({ title, icon: Icon, persona = "seeker" }: PlaceholderPageProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        {persona === "admin" && (
          <button onClick={() => navigate(-1)} className="p-1 active:scale-95">
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="text-lg font-bold">{title}</h1>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary">
          <Icon size={36} className="text-muted-foreground" />
        </div>
        <p className="text-center text-muted-foreground text-sm">
          Coming Soon — Building with 🐝
        </p>
      </main>

      {/* Bottom Nav */}
      {persona !== "admin" && <BottomNav persona={persona} />}
    </div>
  );
};

export default PlaceholderPage;
