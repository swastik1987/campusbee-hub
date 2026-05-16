import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Crown, GraduationCap, Loader2, User, Users } from "lucide-react";

export interface ProviderProfileData {
  providerType: "individual" | "academy";
  businessName: string;
  bio: string;
}

interface StepProviderProfileProps {
  onNext: (data: ProviderProfileData) => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

const StepProviderProfile = ({ onNext, onBack, isSubmitting = false }: StepProviderProfileProps) => {
  const [providerType, setProviderType] = useState<"individual" | "academy" | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [bio, setBio] = useState("");

  const canContinue = providerType && businessName.trim();

  const handleSubmit = () => {
    if (!canContinue || !providerType) return;
    onNext({
      providerType,
      businessName: businessName.trim(),
      bio: bio.trim(),
    });
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Set up your provider profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us about your services
          </p>
        </div>
      </div>

      {/* Provider type selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">What type of provider are you?</Label>
        <div className="grid grid-cols-2 gap-3">
          <Card
            className={`flex cursor-pointer flex-col items-center gap-2 p-4 text-center transition-all ${
              providerType === "individual"
                ? "border-provider bg-provider/5 ring-1 ring-provider"
                : "hover:border-muted-foreground/40"
            }`}
            onClick={() => setProviderType("individual")}
          >
            <User size={24} className={providerType === "individual" ? "text-provider" : "text-muted-foreground"} />
            <div>
              <p className="text-sm font-semibold">Individual</p>
              <p className="text-[10px] text-muted-foreground">I teach classes myself</p>
            </div>
          </Card>
          <Card
            className={`flex cursor-pointer flex-col items-center gap-2 p-4 text-center transition-all ${
              providerType === "academy"
                ? "border-provider bg-provider/5 ring-1 ring-provider"
                : "hover:border-muted-foreground/40"
            }`}
            onClick={() => setProviderType("academy")}
          >
            <Users size={24} className={providerType === "academy" ? "text-provider" : "text-muted-foreground"} />
            <div>
              <p className="text-sm font-semibold">Academy</p>
              <p className="text-[10px] text-muted-foreground">I run an organization</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Academy → Coaches nudge (Premium feature) */}
      {providerType === "academy" && (
        <Card className="flex items-start gap-3 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <Crown size={16} className="text-amber-600" />
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-semibold text-amber-900">
              Onboard Coaches with Premium
            </p>
            <p className="text-xs text-amber-800">
              Invite multiple coaches to manage your batches and classes.
              Available with the Premium plan — you can upgrade any time from your dashboard.
            </p>
          </div>
        </Card>
      )}

      {/* Business name */}
      <div className="space-y-2">
        <Label htmlFor="businessName">
          {providerType === "academy" ? "Academy / Business Name" : "Display Name"}
        </Label>
        <Input
          id="businessName"
          placeholder={providerType === "academy" ? "e.g. Star Sports Academy" : "e.g. Coach Rahul"}
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="h-12 rounded-xl"
        />
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio">Brief description (optional)</Label>
        <Textarea
          id="bio"
          placeholder="Tell learners what you offer..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="rounded-xl resize-none"
          rows={3}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!canContinue || isSubmitting}
        className="w-full gradient-primary text-primary-foreground h-12 font-semibold rounded-xl"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="mr-2 animate-spin" />
            Creating profile…
          </>
        ) : (
          <>
            <GraduationCap size={18} className="mr-2" />
            Finish
          </>
        )}
      </Button>
    </div>
  );
};

export default StepProviderProfile;
