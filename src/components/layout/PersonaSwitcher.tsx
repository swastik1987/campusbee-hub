import { useNavigate } from "react-router-dom";
import { useUser, Persona } from "@/contexts/UserContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Home, GraduationCap, Shield, ChevronDown, ArrowRight, Check } from "lucide-react";
import { useState } from "react";

const PERSONA_CONFIG: Record<
  Persona,
  {
    label: string;
    description: string;
    icon: typeof Home;
    color: string;
    bgColor: string;
    homePath: string;
  }
> = {
  seeker: {
    label: "Seeker",
    description: "Discover & enroll in classes",
    icon: Home,
    color: "text-primary",
    bgColor: "bg-primary/10",
    homePath: "/home",
  },
  provider: {
    label: "Provider",
    description: "Manage classes & students",
    icon: GraduationCap,
    color: "text-provider",
    bgColor: "bg-provider/10",
    homePath: "/provider/dashboard",
  },
  apartment_admin: {
    label: "Admin",
    description: "Manage your apartment community",
    icon: Shield,
    color: "text-admin",
    bgColor: "bg-admin/10",
    homePath: "/admin/dashboard",
  },
  platform_admin: {
    label: "Platform Admin",
    description: "Manage the platform",
    icon: Shield,
    color: "text-admin",
    bgColor: "bg-admin/10",
    homePath: "/admin/dashboard",
  },
};

const PersonaSwitcher = () => {
  const { profile, activePersona, activatePersona } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!profile) return null;

  const current = PERSONA_CONFIG[activePersona];
  const CurrentIcon = current.icon;

  const availablePersonas: Persona[] = ["seeker"];
  if (profile.is_provider) availablePersonas.push("provider");
  if (profile.is_apartment_admin) availablePersonas.push("apartment_admin");
  if (profile.is_platform_admin) availablePersonas.push("platform_admin");

  const handleSelect = async (persona: Persona) => {
    await activatePersona(persona);
    setOpen(false);
    navigate(PERSONA_CONFIG[persona].homePath);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent">
          <CurrentIcon size={14} className={current.color} />
          <span>{current.label}</span>
          <ChevronDown size={12} className="text-muted-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Switch Persona</SheetTitle>
        </SheetHeader>

        <div className="space-y-2 pb-6">
          {availablePersonas.map((persona) => {
            const config = PERSONA_CONFIG[persona];
            const Icon = config.icon;
            const isActive = persona === activePersona;

            return (
              <button
                key={persona}
                onClick={() => handleSelect(persona)}
                className={`flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors ${
                  isActive
                    ? "bg-primary/5 border border-primary/20"
                    : "hover:bg-accent"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bgColor}`}
                >
                  <Icon size={20} className={config.color} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{config.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {config.description}
                  </p>
                </div>
                {isActive && <Check size={18} className="text-primary" />}
              </button>
            );
          })}

          {/* Start Teaching CTA if not a provider */}
          {!profile.is_provider && (
            <button
              onClick={() => {
                setOpen(false);
                navigate("/profile");
              }}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-provider/30 p-4 text-left transition-colors hover:border-provider hover:bg-provider/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-provider/10">
                <GraduationCap size={20} className="text-provider" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-provider">
                  Start Teaching
                </p>
                <p className="text-xs text-muted-foreground">
                  Become a provider on CampusBee
                </p>
              </div>
              <ArrowRight size={16} className="text-provider" />
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PersonaSwitcher;
