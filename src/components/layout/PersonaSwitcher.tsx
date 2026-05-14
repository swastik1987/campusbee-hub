import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser, Persona } from "@/contexts/UserContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Home,
  GraduationCap,
  Shield,
  ChevronDown,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

const PERSONA_CONFIG: Record<
  Persona,
  {
    label: string;
    description: string;
    icon: typeof Home;
    color: string;
    bgColor: string;
    accent: string;
    gradient: string;
    homePath: string;
  }
> = {
  seeker: {
    label: "Learner",
    description: "Discover & enroll in classes",
    icon: Home,
    color: "text-primary",
    bgColor: "bg-primary/10",
    accent: "oklch(0.62 0.20 250)",
    gradient: "from-[oklch(0.78_0.18_250)] to-[oklch(0.62_0.20_250)]",
    homePath: "/explore",
  },
  provider: {
    label: "Instructor",
    description: "Manage classes & students",
    icon: GraduationCap,
    color: "text-provider",
    bgColor: "bg-provider/10",
    accent: "oklch(0.58 0.20 290)",
    gradient: "from-[oklch(0.70_0.18_290)] to-[oklch(0.55_0.20_290)]",
    homePath: "/provider/dashboard",
  },
  platform_admin: {
    label: "Platform Admin",
    description: "Manage the platform",
    icon: Shield,
    color: "text-admin",
    bgColor: "bg-admin/10",
    accent: "oklch(0.50 0.05 240)",
    gradient: "from-slate-500 to-slate-700",
    homePath: "/platform",
  },
};

const PersonaSwitcher = React.forwardRef<HTMLButtonElement>((_, ref) => {
  const { profile, activePersona, activatePersona } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!profile) return null;

  const path = location.pathname;
  const pathPersona: Persona | null =
    path === "/explore" || path === "/my-classes"
      ? "seeker"
      : path === "/provider/dashboard" ||
        path === "/provider/classes" ||
        path === "/provider/students" ||
        path === "/provider/payments"
      ? "provider"
      : null;

  const displayPersona = pathPersona ?? activePersona;
  const current = PERSONA_CONFIG[displayPersona];
  const CurrentIcon = current.icon;

  const availablePersonas: Persona[] = ["seeker"];
  if (profile.is_provider) availablePersonas.push("provider");
  if (profile.is_platform_admin) availablePersonas.push("platform_admin");

  const handleSelect = async (persona: Persona) => {
    setOpen(false);
    await activatePersona(persona);
    navigate(PERSONA_CONFIG[persona].homePath);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          data-persona-trigger
          style={
            {
              "--persona-accent": current.accent,
            } as React.CSSProperties
          }
          className="group flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm transition-all hover:border-[color:var(--persona-accent)] hover:shadow-md hover:bg-[color:var(--persona-accent)] hover:text-white data-[state=open]:border-transparent data-[state=open]:bg-[color:var(--persona-accent)] data-[state=open]:text-white data-[state=open]:shadow-md"
        >
          <CurrentIcon
            size={14}
            className={`${current.color} transition-colors group-hover:text-white group-data-[state=open]:text-white`}
          />
          <span>{current.label}</span>
          <ChevronDown
            size={12}
            className="text-muted-foreground transition-all group-hover:rotate-180 group-hover:text-white group-data-[state=open]:rotate-180 group-data-[state=open]:text-white"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[300px] overflow-hidden rounded-2xl border-0 bg-transparent p-0 shadow-2xl"
      >
        {/* Gradient outer ring */}
        <div
          className="rounded-2xl p-[1.5px]"
          style={{
            background: `linear-gradient(135deg, ${current.accent}, oklch(0.85 0.10 60))`,
          }}
        >
          {/* Glass panel */}
          <div className="relative rounded-[14px] bg-card/95 p-3 backdrop-blur-xl">
            {/* Animated sheen */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-12 rounded-t-[14px] opacity-60"
              style={{
                background: `linear-gradient(180deg, ${current.accent}1a 0%, transparent 100%)`,
              }}
            />

            <div className="relative space-y-1.5">
              <div className="flex items-center gap-1.5 px-2 pb-1 pt-0.5">
                <Sparkles size={12} className="text-muted-foreground/70" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Switch Persona
                </p>
              </div>

              {availablePersonas.map((persona, idx) => {
                const config = PERSONA_CONFIG[persona];
                const Icon = config.icon;
                const isActive = persona === displayPersona;

                return (
                  <button
                    key={persona}
                    onClick={() => handleSelect(persona)}
                    style={{
                      animationDelay: `${idx * 40}ms`,
                    }}
                    className={`group/item relative flex w-full animate-in fade-in slide-in-from-top-2 items-center gap-3 overflow-hidden rounded-xl p-3 text-left transition-all duration-200 fill-mode-both ${
                      isActive
                        ? "bg-gradient-to-r shadow-sm ring-1 ring-inset"
                        : "hover:scale-[1.02] hover:bg-accent/60 active:scale-[0.99]"
                    }`}
                  >
                    {isActive && (
                      <span
                        className="absolute inset-0 opacity-[0.08]"
                        style={{
                          background: `linear-gradient(135deg, ${config.accent}, transparent)`,
                        }}
                      />
                    )}
                    {isActive && (
                      <span
                        className="absolute inset-y-2 left-0 w-[3px] rounded-r-full"
                        style={{ background: config.accent }}
                      />
                    )}

                    <div
                      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover/item:scale-110 ${
                        isActive
                          ? `bg-gradient-to-br ${config.gradient} shadow-md`
                          : config.bgColor
                      }`}
                    >
                      <Icon
                        size={18}
                        className={isActive ? "text-white" : config.color}
                      />
                    </div>

                    <div className="relative flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold leading-tight ${
                          isActive ? config.color : ""
                        }`}
                      >
                        {config.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                        {config.description}
                      </p>
                    </div>

                    {isActive && (
                      <div
                        className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ background: config.accent }}
                      >
                        <Check size={13} strokeWidth={3} />
                      </div>
                    )}
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
                  className="group/cta relative mt-1 flex w-full items-center gap-3 overflow-hidden rounded-xl border border-dashed border-provider/30 p-3 text-left transition-all hover:border-provider hover:bg-provider/5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-provider/10 transition-transform group-hover/cta:scale-110">
                    <GraduationCap size={18} className="text-provider" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-provider">
                      Start Teaching
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Become an instructor on CampusBee
                    </p>
                  </div>
                  <ArrowRight
                    size={15}
                    className="text-provider transition-transform group-hover/cta:translate-x-0.5"
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

PersonaSwitcher.displayName = "PersonaSwitcher";

export default PersonaSwitcher;
