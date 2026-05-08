import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddFamilyMembers, calculateAgeGroup } from "@/hooks/useOnboarding";
import { useUser } from "@/contexts/UserContext";
import {
  CheckCircle,
  ChevronLeft,
  Loader2,
  Lock,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

interface MemberInput {
  name: string;
  relationship: string;
  dateOfBirth: string;
  gender: string;
}

interface StepFamilyProps {
  familyId: string;
  onComplete: () => void;
  onBack: () => void;
}

// "self" is already created by StepLocation — hide it from the additional-member dropdown.
const RELATIONSHIPS = [
  { value: "son",      label: "Son"      },
  { value: "daughter", label: "Daughter" },
  { value: "spouse",   label: "Spouse"   },
  { value: "parent",   label: "Parent"   },
  { value: "sibling",  label: "Sibling"  },
  { value: "other",    label: "Other"    },
];

// DB CHECK: gender IN ('male','female','other','prefer_not_to_say')
const GENDERS = [
  { value: "male",              label: "Male"              },
  { value: "female",            label: "Female"            },
  { value: "other",             label: "Other"             },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const emptyMember = (): MemberInput => ({
  name: "",
  relationship: "",
  dateOfBirth: "",
  gender: "",
});

const StepFamily = React.forwardRef<HTMLDivElement, StepFamilyProps>(
  ({ familyId, onComplete, onBack }, ref) => {
    const { profile } = useUser();
    // Additional members only — "self" row was created in StepLocation.
    const [members, setMembers] = useState<MemberInput[]>([]);
    const addFamilyMembers = useAddFamilyMembers();

    const updateMember = (index: number, field: keyof MemberInput, value: string) => {
      setMembers((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
      );
    };

    const addMember = () => setMembers((prev) => [...prev, emptyMember()]);

    const removeMember = (index: number) => {
      setMembers((prev) => prev.filter((_, i) => i !== index));
    };

    // Valid when there are no extra members, or every extra member has a name & relationship.
    const isValid =
      members.length === 0 ||
      members.every((m) => m.name.trim() && m.relationship);

    const handleDone = async () => {
      if (members.length === 0) {
        // Nothing to insert — self member already exists, move on.
        onComplete();
        return;
      }

      if (!isValid) return;

      const payload = members.map((m) => ({
        family_id: familyId,
        full_name: m.name.trim(),
        relationship: m.relationship,
        date_of_birth: m.dateOfBirth || null,
        age_group: m.dateOfBirth ? calculateAgeGroup(m.dateOfBirth) : null,
        gender: m.gender || null,
      }));

      try {
        await addFamilyMembers.mutateAsync(payload);
        toast.success("Family members added!");
        onComplete();
      } catch (err: unknown) {
        console.error("[StepFamily] insert failed", err);
        const msg = err instanceof Error ? err.message : "Failed to add family members";
        toast.error(msg);
      }
    };

    return (
      <div ref={ref} className="space-y-6 animate-fade-up">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-foreground">Add family members</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You're already set up. Add anyone else you'd like to enroll in classes.
            </p>
          </div>
        </div>

        {/* Locked "You" card — created automatically in the previous step */}
        <Card className="border-2 border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">
                {profile?.full_name?.[0]?.toUpperCase() ?? "Y"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold truncate">
                  {profile?.full_name ?? "You"}
                </p>
                <span className="text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  You
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Lock size={10} />
                Self · Already added
              </p>
            </div>
            <CheckCircle size={18} className="text-primary flex-shrink-0" />
          </div>
        </Card>

        {/* Optional additional members */}
        <div className="space-y-4 max-h-[calc(100vh-380px)] overflow-y-auto pb-2">
          {members.map((member, index) => (
            <Card key={index} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  Member {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeMember(index)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Full name</Label>
                <Input
                  placeholder="e.g. Arjun, Mom…"
                  value={member.name}
                  onChange={(e) => updateMember(index, "name", e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Relationship</Label>
                  <Select
                    value={member.relationship}
                    onValueChange={(v) => updateMember(index, "relationship", v)}
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIPS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Gender</Label>
                  <Select
                    value={member.gender}
                    onValueChange={(v) => updateMember(index, "gender", v)}
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">
                  Date of Birth{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  type="date"
                  value={member.dateOfBirth}
                  onChange={(e) => updateMember(index, "dateOfBirth", e.target.value)}
                  className="h-10 rounded-lg"
                  max={new Date().toISOString().split("T")[0]}
                />
                {member.dateOfBirth && (
                  <p className="text-xs text-muted-foreground">
                    Age group:{" "}
                    <span className="font-medium capitalize text-foreground">
                      {calculateAgeGroup(member.dateOfBirth)}
                    </span>
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>

        <button
          type="button"
          onClick={addMember}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus size={16} />
          Add a family member
        </button>

        <Button
          onClick={handleDone}
          disabled={!isValid || addFamilyMembers.isPending}
          className="w-full gradient-primary text-primary-foreground h-12 font-semibold rounded-xl"
        >
          {addFamilyMembers.isPending ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <UserPlus size={18} className="mr-2" />
              {members.length === 0 ? "Done" : "Save & Continue"}
            </>
          )}
        </Button>
      </div>
    );
  }
);

StepFamily.displayName = "StepFamily";

export default StepFamily;
