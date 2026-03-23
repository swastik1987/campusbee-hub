import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import StepProfile from "@/components/onboarding/StepProfile";
import StepApartment from "@/components/onboarding/StepApartment";
import StepFamily from "@/components/onboarding/StepFamily";
import { LogOut, X } from "lucide-react";
import { toast } from "sonner";

const STEPS = ["About You", "Apartment", "Family"];

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { profile, refreshProfile, refreshFamily } = useUser();

  const handleComplete = async () => {
    await Promise.all([refreshProfile(), refreshFamily()]);
    navigate("/home", { replace: true });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
    toast.success("Logged out");
  };

  const handleSkip = () => {
    // If user is an admin, send them to their admin panel
    if (profile?.is_platform_admin) {
      navigate("/platform", { replace: true });
    } else if (profile?.is_apartment_admin) {
      navigate("/admin/dashboard", { replace: true });
    } else {
      // Regular users - go to landing which will show logged-in state
      navigate("/", { replace: true });
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
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="text-xs font-semibold text-primary">
            {STEPS[step]}
          </span>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
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
        {step === 0 && (
          <StepProfile onNext={() => setStep(1)} />
        )}
        {step === 1 && (
          <StepApartment
            onNext={(fId) => {
              setFamilyId(fId);
              setStep(2);
            }}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StepFamily
            familyId={familyId!}
            onComplete={handleComplete}
            onBack={() => setStep(1)}
          />
        )}
      </div>
    </div>
  );
};

export default Onboarding;
