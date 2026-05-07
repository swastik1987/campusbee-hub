import * as React from "react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useCreateProviderOnboarding } from "@/hooks/useOnboarding";
import { supabase } from "@/integrations/supabase/client";
import StepProfile from "@/components/onboarding/StepProfile";
import StepRoleSelect from "@/components/onboarding/StepRoleSelect";
import StepLocation from "@/components/onboarding/StepLocation";
import StepFamily from "@/components/onboarding/StepFamily";
import StepProviderProfile from "@/components/onboarding/StepProviderProfile";
import type { ProviderProfileData } from "@/components/onboarding/StepProviderProfile";
import { LogOut, X } from "lucide-react";
import { toast } from "sonner";

// Design tokens
const A_FROM = "oklch(0.78 0.18 250)";
const A_TO   = "oklch(0.62 0.20 250)";

type Role = "seeker" | "provider" | null;

// v2 flows
//  With URL ?role=seeker:   Profile → Location → Family        (3 steps)
//  With URL ?role=provider: Profile → ProviderProfile          (2 steps)
//  No URL role (fallback):  Profile → Role → Location → Family (4 steps, seeker)
//                           Profile → Role → ProviderProfile   (3 steps, provider)

const Onboarding = React.forwardRef<HTMLDivElement, Record<string, never>>((_props, ref) => {
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const { profile, refreshProfile, refreshFamily } = useUser();
  const createProvider = useCreateProviderOnboarding();

  // Read role from URL param — landing page sets ?role=seeker or ?role=provider
  const urlRoleRaw = params.get("role");
  const urlRole: Role =
    urlRoleRaw === "seeker" ? "seeker" :
    urlRoleRaw === "provider" ? "provider" : null;

  // hasPresetRole = true → skip the StepRoleSelect step
  const hasPresetRole = urlRole !== null;

  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>(urlRole);
  const [familyId, setFamilyId] = useState<string | null>(null);

  // ── Step labels ──────────────────────────────────────────────────────────
  const getStepLabels = (): string[] => {
    if (hasPresetRole) {
      if (role === "provider") return ["About You", "Your Business"];
      return ["About You", "Location", "Family"];
    }
    // Fallback flow (no URL role)
    if (role === "provider") return ["About You", "Role", "Your Business"];
    if (role === "seeker")   return ["About You", "Role", "Location", "Family"];
    return ["About You", "Role"];
  };
  const stepLabels = getStepLabels();
  const totalSteps = stepLabels.length;

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleRoleSelect = (selected: "seeker" | "provider") => {
    setRole(selected);
    setStep(2);
  };

  const handleProviderComplete = async (data: ProviderProfileData) => {
    if (!profile) return;
    try {
      await createProvider.mutateAsync({
        userId: profile.id,
        providerType: data.providerType,
        businessName: data.businessName,
        bio: data.bio,
      });
      toast.success("Welcome aboard! Your provider profile is live.");
      await refreshProfile();
      navigate("/provider/dashboard", { replace: true });
    } catch (err) {
      console.error("[Onboarding] provider create failed", err);
      toast.error("Failed to create provider profile");
    }
  };

  const handleSeekerComplete = async () => {
    await Promise.all([refreshProfile(), refreshFamily()]);
    navigate("/home", { replace: true });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
    toast.success("Logged out");
  };

  const handleSkip = () => {
    if (profile?.is_platform_admin) {
      navigate("/platform", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  // ── Step renderer ────────────────────────────────────────────────────────
  const renderStep = () => {
    if (hasPresetRole) {
      // Shortened flow: role is known from URL
      switch (step) {
        case 0:
          return <StepProfile onNext={() => setStep(1)} />;
        case 1:
          if (role === "provider") {
            return (
              <StepProviderProfile
                onNext={handleProviderComplete}
                onBack={() => setStep(0)}
                isSubmitting={createProvider.isPending}
              />
            );
          }
          // Seeker: location
          if (!profile) return null;
          return (
            <StepLocation
              userId={profile.id}
              onNext={(fId) => {
                setFamilyId(fId);
                setStep(2);
              }}
              onBack={() => setStep(0)}
            />
          );
        case 2:
          // Seeker only — family
          if (role !== "seeker" || !familyId) return null;
          return (
            <StepFamily
              familyId={familyId}
              onComplete={handleSeekerComplete}
              onBack={() => setStep(1)}
            />
          );
        default:
          return null;
      }
    }

    // Fallback flow: no URL role — show role selection step
    switch (step) {
      case 0:
        return <StepProfile onNext={() => setStep(1)} />;
      case 1:
        return <StepRoleSelect onSelect={handleRoleSelect} />;
      case 2:
        if (role === "provider") {
          return (
            <StepProviderProfile
              onNext={handleProviderComplete}
              onBack={() => setStep(1)}
              isSubmitting={createProvider.isPending}
            />
          );
        }
        if (!profile) return null;
        return (
          <StepLocation
            userId={profile.id}
            onNext={(fId) => {
              setFamilyId(fId);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        );
      case 3:
        if (role !== "seeker" || !familyId) return null;
        return (
          <StepFamily
            familyId={familyId}
            onComplete={handleSeekerComplete}
            onBack={() => setStep(2)}
          />
        );
      default:
        return null;
    }
  };

  const isSeeker = role === "seeker";

  return (
    <div
      ref={ref}
      className={`${isSeeker ? "seeker-theme" : ""} flex min-h-screen flex-col bg-background`}
      style={{ position: "relative", overflow: "hidden" }}
    >
      {/* Aurora background blobs — tinted to current role */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: -120, right: -80,
          width: 280, height: 280, borderRadius: "50%",
          background: isSeeker ? A_FROM : "oklch(0.72 0.18 25)",
          filter: "blur(70px)", opacity: 0.18, pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute", bottom: -140, left: -80,
          width: 260, height: 260, borderRadius: "50%",
          background: isSeeker ? "oklch(0.85 0.15 200)" : "oklch(0.80 0.18 45)",
          filter: "blur(70px)", opacity: 0.13, pointerEvents: "none",
        }}
      />

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-between px-4 pt-4 pb-0">
        {/* Logo mark */}
        <div className="flex items-center gap-2.5">
          <div
            style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 15,
            }}
          >
            C
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.3, color: "var(--foreground)" }}>
            CampusBee
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut size={13} />
            Log out
          </button>
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Skip
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────── */}
      <div className="relative px-5 pt-3 pb-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">
            Step {step + 1} of {totalSteps}
          </span>
          <span className="text-[11px] font-bold text-primary">
            {stepLabels[step] ?? ""}
          </span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= step
                  ? isSeeker ? "" : "bg-primary"
                  : "bg-muted"
              }`}
              style={
                i <= step && isSeeker
                  ? { background: `linear-gradient(90deg, ${A_FROM}, ${A_TO})` }
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      <div className="relative flex-1 px-6 py-6">{renderStep()}</div>
    </div>
  );
});

Onboarding.displayName = "Onboarding";

export default Onboarding;
