import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useCreateProviderOnboarding } from "@/hooks/useOnboarding";
import { supabase } from "@/integrations/supabase/client";
import StepProfile from "@/components/onboarding/StepProfile";
import StepRoleSelect from "@/components/onboarding/StepRoleSelect";
import StepApartment from "@/components/onboarding/StepApartment";
import StepFamily from "@/components/onboarding/StepFamily";
import StepProviderProfile from "@/components/onboarding/StepProviderProfile";
import type { ProviderProfileData } from "@/components/onboarding/StepProviderProfile";
import StepProviderApartments from "@/components/onboarding/StepProviderApartments";
import { LogOut, X } from "lucide-react";
import { toast } from "sonner";

type Role = "seeker" | "provider" | null;

// Seeker flow:  Profile → Role → Apartment → Family
// Provider flow: Profile → Role → ProviderProfile → ProviderApartments

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [providerData, setProviderData] = useState<ProviderProfileData | null>(null);

  const navigate = useNavigate();
  const { profile, refreshProfile, refreshFamily } = useUser();
  const createProvider = useCreateProviderOnboarding();

  // Step labels depend on the selected role
  const getStepLabels = (): string[] => {
    if (role === "provider") return ["About You", "Role", "Profile", "Apartments"];
    if (role === "seeker") return ["About You", "Role", "Apartment", "Family"];
    // Before role is chosen, show generic labels
    return ["About You", "Role"];
  };

  const stepLabels = getStepLabels();
  const totalSteps = stepLabels.length;

  const handleRoleSelect = (selected: "seeker" | "provider") => {
    setRole(selected);
    setStep(2); // Move to step 2 (first role-specific step)
  };

  const handleProviderComplete = async (apartmentIds: string[]) => {
    if (!providerData || !profile) return;

    try {
      await createProvider.mutateAsync({
        userId: profile.id,
        providerType: providerData.providerType,
        businessName: providerData.businessName,
        bio: providerData.bio,
        apartmentIds,
      });
      toast.success("Provider profile created! Apartment admins will review your application.");
      await refreshProfile();
      navigate("/provider/dashboard", { replace: true });
    } catch {
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
    } else if (profile?.is_apartment_admin) {
      navigate("/admin/dashboard", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  // Render the current step
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
              onNext={(data) => {
                setProviderData(data);
                setStep(3);
              }}
              onBack={() => setStep(1)}
            />
          );
        }
        // Seeker: apartment step
        return (
          <StepApartment
            onNext={(fId) => {
              setFamilyId(fId);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        );
      case 3:
        if (role === "provider") {
          return (
            <StepProviderApartments
              onNext={handleProviderComplete}
              onBack={() => setStep(2)}
              isSubmitting={createProvider.isPending}
            />
          );
        }
        // Seeker: family step
        return (
          <StepFamily
            familyId={familyId!}
            onComplete={handleSeekerComplete}
            onBack={() => setStep(2)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar with logout and skip */}
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

      {/* Progress bar */}
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

      {/* Step content */}
      <div className="flex-1 px-6 py-6">
        {renderStep()}
      </div>
    </div>
  );
};

export default Onboarding;
