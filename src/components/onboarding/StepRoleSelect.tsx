import { Card } from "@/components/ui/card";
import { GraduationCap, Home, ChevronRight } from "lucide-react";

interface StepRoleSelectProps {
  onSelect: (role: "seeker" | "provider") => void;
}

const StepRoleSelect = ({ onSelect }: StepRoleSelectProps) => {
  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="text-xl font-bold text-foreground">How will you use CampusBee?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You can always switch or add the other role later
        </p>
      </div>

      <div className="space-y-3">
        <Card
          className="flex cursor-pointer items-center gap-4 p-5 transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
          onClick={() => onSelect("seeker")}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <Home size={24} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">I'm looking for classes</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Find and enroll in classes for yourself or your family
            </p>
          </div>
          <ChevronRight size={18} className="text-muted-foreground" />
        </Card>

        <Card
          className="flex cursor-pointer items-center gap-4 p-5 transition-all hover:border-provider hover:bg-provider/5 active:scale-[0.98]"
          onClick={() => onSelect("provider")}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
            <GraduationCap size={24} className="text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">I'm a service provider</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Offer classes and services in apartment communities
            </p>
          </div>
          <ChevronRight size={18} className="text-muted-foreground" />
        </Card>
      </div>
    </div>
  );
};

export default StepRoleSelect;
