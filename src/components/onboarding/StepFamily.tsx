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
import { ChevronLeft, Loader2, Plus, Trash2, UserPlus, Users } from "lucide-react";
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

const RELATIONSHIPS = ["Self", "Son", "Daughter", "Spouse", "Parent", "Other"];
const GENDERS = ["Male", "Female", "Other"];

const emptyMember = (): MemberInput => ({
  name: "",
  relationship: "",
  dateOfBirth: "",
  gender: "",
});

const StepFamily = ({ familyId, onComplete, onBack }: StepFamilyProps) => {
  const [members, setMembers] = useState<MemberInput[]>([emptyMember()]);
  const addFamilyMembers = useAddFamilyMembers();

  const updateMember = (index: number, field: keyof MemberInput, value: string) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const addMember = () => setMembers((prev) => [...prev, emptyMember()]);

  const removeMember = (index: number) => {
    if (members.length <= 1) return;
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const isValid = members.every(
    (m) => m.name.trim() && m.relationship
  );

  const handleSubmit = async () => {
    if (!isValid) return;

    const payload = members.map((m) => ({
      family_id: familyId,
      name: m.name.trim(),
      relationship: m.relationship,
      date_of_birth: m.dateOfBirth || null,
      age_group: m.dateOfBirth ? calculateAgeGroup(m.dateOfBirth) : null,
      gender: m.gender || null,
    }));

    try {
      await addFamilyMembers.mutateAsync(payload);
      toast.success("Family members added!");
      onComplete();
    } catch {
      toast.error("Failed to add family members");
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Add your family</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Who will be taking classes?
          </p>
        </div>
      </div>

      <div className="space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto pb-2">
        {members.map((member, index) => (
          <Card key={index} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <span className="text-sm font-semibold">
                  Member {index + 1}
                </span>
              </div>
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMember(index)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="Full name"
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
                      <SelectItem key={r} value={r}>
                        {r}
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
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Date of Birth</Label>
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
        Add another member
      </button>

      <Button
        onClick={handleSubmit}
        disabled={!isValid || addFamilyMembers.isPending}
        className="w-full gradient-primary text-primary-foreground h-12 font-semibold rounded-xl"
      >
        {addFamilyMembers.isPending ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <>
            <UserPlus size={18} className="mr-2" />
            Complete Setup
          </>
        )}
      </Button>
    </div>
  );
};

export default StepFamily;
