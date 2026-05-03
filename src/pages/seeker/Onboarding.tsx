import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

type Role = "seeker" | "provider" | null;

// v2 flows
//  Seeker:   Profile → Role → Location → Family
//  Provider: Profile → Role → ProviderProfile (auto-approved Basic tier)

const Onboarding = React.forwardRef<HTMLDivElement, Record<string, never>>((_props, ref) => {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);

  const navigate = useNavigate();
  const { profile, refreshProfile, refreshFamily } = useUser();
  const createProvider = useCreateProviderOnboarding();

  const getStepLabels = (): string[] => {
    if (role === "provider") return ["About You", "Role", "Profile"];
    if (role === "seeker") return ["About You", "Role", "Location", "Family"];
    return ["About You", "Role"];
  };
  const stepLabels = getStepLabels();
  const totalSteps = stepLabels.length;

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
    navigate("/explore", { replace: true });
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

  const renderStep = () => {
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
        // Seeker: location step
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
        // Seeker only — family
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

  return (
    <div ref={ref} className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between px-4 pt-4 pb-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut size={14} />
          Log out
        </button>
        <button
          onClick={handleSkip}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Skip for now
          <X size={14} />
        </button>
      </div>

      <div className="px-6 pt-2 pb-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Step {step + 1} of {totalSteps}
          </span>
          <span className="text-xs font-semibold text-primary">
            {stepLabels[step] ?? ""}
          </span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "gradient-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-6">{renderStep()}</div>
    </div>
  );
});

Onboarding.displayName = "Onboarding";

export default Onboarding;
