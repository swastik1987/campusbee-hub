import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import StepProfile from "@/components/onboarding/StepProfile";
import StepApartment from "@/components/onboarding/StepApartment";
import StepFamily from "@/components/onboarding/StepFamily";

const STEPS = ["About You", "Apartment", "Family"];

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { refreshProfile, refreshFamily } = useUser();

  const handleComplete = async () => {
    await Promise.all([refreshProfile(), refreshFamily()]);
    navigate("/home", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Progress bar */}
      <div className="px-6 pt-6 pb-2">
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
