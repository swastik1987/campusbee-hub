import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useCoaches,
  useCoachAssignments,
  useInviteCoach,
  useAssignCoach,
  useEndCoachAssignment,
  useRemoveCoach,
  type Coach,
  type CoachAssignment,
} from "@/hooks/useCoaches";
import { useProviderClasses } from "@/hooks/useClasses";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import PremiumGate from "@/components/subscription/PremiumGate";
import UpgradeRequestSheet from "@/components/subscription/UpgradeRequestSheet";
import Header from "@/components/layout/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ClipboardList,
  Crown,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type AcademyBatch = { id: string; batch_name: string; class_id: string };

/** Lookup batches scoped to the academy's classes (admin can see all) */
function useAcademyBatches(classIds: string[]) {
  return useQuery({
    queryKey: ["academy-batches", classIds.join(",")],
    enabled: classIds.length > 0,
    queryFn: async (): Promise<AcademyBatch[]> => {
      const { data, error } = await supabase
        .from("batches")
        .select("id, batch_name, class_id")
        .in("class_id", classIds)
        .order("batch_name");
      if (error) throw error;
      return (data ?? []) as AcademyBatch[];
    },
  });
}

const CoachesManagement = () => {
  const navigate = useNavigate();
  const { providerProfile, isPremium } = useUser();
  const providerId = providerProfile?.id;
  const isAcademy = providerProfile?.provider_type === "academy";

  const { data: coaches, isLoading } = useCoaches(providerId);
  const { data: assignments } = useCoachAssignments(providerId);
  const { data: classes } = useProviderClasses(providerId);
  const classIds = useMemo(() => (classes ?? []).map((c) => c.id), [classes]);
  const { data: batches } = useAcademyBatches(classIds);

  const inviteMut = useInviteCoach();
  const assignMut = useAssignCoach();
  const endAssignMut = useEndCoachAssignment();
  const removeMut = useRemoveCoach();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [assignSheet, setAssignSheet] = useState<Coach | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<Coach | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Invite form state
  const [iName, setIName] = useState("");
  const [iEmail, setIEmail] = useState("");
  const [iPhone, setIPhone] = useState("");
  const [iBio, setIBio] = useState("");
  const [iQual, setIQual] = useState("");
  const [iExp, setIExp] = useState("");

  // Assign form state
  const [aScopeType, setAScopeType] = useState<"class" | "batch">("class");
  const [aScopeId, setAScopeId] = useState<string>("");
  const [aTemporary, setATemporary] = useState(false);
  const [aValidFrom, setAValidFrom] = useState("");
  const [aValidUntil, setAValidUntil] = useState("");

  // Group active assignments by coach — must run on every render to keep hook order stable.
  const assignmentsByCoach = useMemo(() => {
    const map: Record<string, CoachAssignment[]> = {};
    (assignments ?? []).forEach((a) => {
      if (!map[a.coach_id]) map[a.coach_id] = [];
      map[a.coach_id].push(a);
    });
    return map;
  }, [assignments]);

  // Not an academy? Friendly empty-state.
  if (!isAcademy) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-20">
        <Header />
        <div className="mx-auto w-full max-w-lg px-4 py-8 text-center">
          <Users size={32} className="mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Coaches are available for Academy providers only.
          </p>
        </div>
      </div>
    );
  }

  const handleInvite = async () => {
    if (!providerId || !iName.trim() || !iEmail.trim()) return;
    try {
      await inviteMut.mutateAsync({
        academyProviderId: providerId,
        fullName: iName.trim(),
        email: iEmail.trim().toLowerCase(),
        phone: iPhone.trim() || undefined,
        bio: iBio.trim() || undefined,
        qualifications: iQual.trim() || undefined,
        experienceYears: iExp ? parseInt(iExp) : null,
      });
      toast.success("Coach invited");
      setIName("");
      setIEmail("");
      setIPhone("");
      setIBio("");
      setIQual("");
      setIExp("");
      setInviteOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invite";
      toast.error(message);
    }
  };

  const handleAssign = async () => {
    if (!assignSheet || !aScopeId) return;
    try {
      await assignMut.mutateAsync({
        coachId: assignSheet.id,
        scopeType: aScopeType,
        scopeId: aScopeId,
        isTemporary: aTemporary,
        validFrom: aTemporary && aValidFrom ? new Date(aValidFrom).toISOString() : undefined,
        validUntil:
          aTemporary && aValidUntil ? new Date(aValidUntil).toISOString() : undefined,
      });
      toast.success(
        aTemporary
          ? "Temporary assignment created — will revert automatically"
          : "Coach assigned"
      );
      setAssignSheet(null);
      setAScopeId("");
      setATemporary(false);
      setAValidFrom("");
      setAValidUntil("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to assign";
      toast.error(message);
    }
  };

  const handleRemove = async () => {
    if (!removeConfirm) return;
    try {
      await removeMut.mutateAsync(removeConfirm.id);
      toast.success("Coach removed");
      setRemoveConfirm(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove";
      toast.error(message);
    }
  };

  const scopeLabel = (scopeType: "class" | "batch", scopeId: string) => {
    if (scopeType === "class") {
      const c = classes?.find((x) => x.id === scopeId);
      return c?.title ?? "Class";
    }
    const b = batches?.find((x) => x.id === scopeId);
    const cls = classes?.find((c) => c.id === b?.class_id);
    return b ? `${cls?.title ?? "Class"} · ${b.batch_name}` : "Batch";
  };

  const content = (
    <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Coaches</h1>
          <p className="text-xs text-muted-foreground">
            Invite coaches to manage your batches &amp; classes
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : coaches && coaches.length > 0 ? (
        <div className="space-y-3">
          {coaches.map((coach) => {
            const coachAssignments = assignmentsByCoach[coach.id] ?? [];
            const isInvited = coach.status === "invited";
            return (
              <Card key={coach.id} className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={coach.photo_url ?? undefined} />
                    <AvatarFallback className="bg-provider/10 text-provider">
                      {coach.full_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{coach.full_name}</p>
                      {isInvited ? (
                        <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700">
                          Invited
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border-0">
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{coach.email}</p>
                    {coach.experience_years ? (
                      <p className="text-[10px] text-muted-foreground">
                        {coach.experience_years} yrs experience
                      </p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => setRemoveConfirm(coach)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    title="Remove coach"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {coachAssignments.length > 0 ? (
                  <div className="space-y-1.5">
                    {coachAssignments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-lg bg-muted/40 px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <ClipboardList size={12} className="text-muted-foreground" />
                            <p className="text-[11px] font-medium truncate">
                              {scopeLabel(a.scope_type, a.scope_id)}
                            </p>
                            {a.is_temporary && (
                              <Badge variant="outline" className="h-4 border-blue-300 px-1 text-[9px] text-blue-700">
                                Temp
                              </Badge>
                            )}
                          </div>
                          {a.is_temporary && a.valid_until && (
                            <p className="text-[9px] text-muted-foreground">
                              until {new Date(a.valid_until).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => endAssignMut.mutate(a.id)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                          title="End assignment"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] italic text-muted-foreground">
                    No active assignments
                  </p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full text-xs border-provider/40 text-provider"
                  onClick={() => setAssignSheet(coach)}
                >
                  <Plus size={12} className="mr-1" /> Assign Class / Batch
                </Button>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Users size={28} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No coaches yet</p>
        </div>
      )}

      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetTrigger asChild>
          <Button className="w-full rounded-xl bg-provider text-white hover:bg-provider/90">
            <UserPlus size={16} className="mr-1" /> Invite Coach
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Invite Coach</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Full name</Label>
              <Input
                value={iName}
                onChange={(e) => setIName(e.target.value)}
                className="h-10 rounded-lg"
                placeholder="e.g. Coach Anjali"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={iEmail}
                onChange={(e) => setIEmail(e.target.value)}
                className="h-10 rounded-lg"
                placeholder="coach@example.com"
              />
              <p className="text-[10px] text-muted-foreground">
                When they log in with this email, they'll automatically get the Coach tag.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone (optional)</Label>
              <Input
                value={iPhone}
                onChange={(e) => setIPhone(e.target.value)}
                className="h-10 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Qualifications (optional)</Label>
              <Input
                value={iQual}
                onChange={(e) => setIQual(e.target.value)}
                className="h-10 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Experience (years)</Label>
              <Input
                type="number"
                value={iExp}
                onChange={(e) => setIExp(e.target.value)}
                className="h-10 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bio (optional)</Label>
              <Textarea
                value={iBio}
                onChange={(e) => setIBio(e.target.value)}
                rows={2}
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleInvite}
              disabled={!iName.trim() || !iEmail.trim() || inviteMut.isPending}
              className="w-full rounded-lg bg-provider text-white"
            >
              {inviteMut.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Send Invite"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Assign sheet */}
      <Sheet open={!!assignSheet} onOpenChange={(o) => !o && setAssignSheet(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Assign {assignSheet?.full_name}</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Scope</Label>
              <Select
                value={aScopeType}
                onValueChange={(v) => {
                  setAScopeType(v as "class" | "batch");
                  setAScopeId("");
                }}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">Entire class (covers all batches)</SelectItem>
                  <SelectItem value="batch">Specific batch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                {aScopeType === "class" ? "Class" : "Batch"}
              </Label>
              <Select value={aScopeId} onValueChange={setAScopeId}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder={`Choose a ${aScopeType}`} />
                </SelectTrigger>
                <SelectContent>
                  {aScopeType === "class"
                    ? (classes ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))
                    : (batches ?? []).map((b) => {
                        const cls = classes?.find((c) => c.id === b.class_id);
                        return (
                          <SelectItem key={b.id} value={b.id}>
                            {cls?.title ?? "Class"} · {b.batch_name}
                          </SelectItem>
                        );
                      })}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={aTemporary}
                onChange={(e) => setATemporary(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span>Temporary swap (auto-reverts to the original coach)</span>
            </label>

            {aTemporary && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar size={12} /> From
                  </Label>
                  <Input
                    type="date"
                    value={aValidFrom}
                    onChange={(e) => setAValidFrom(e.target.value)}
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar size={12} /> Until
                  </Label>
                  <Input
                    type="date"
                    value={aValidUntil}
                    onChange={(e) => setAValidUntil(e.target.value)}
                    className="h-10 rounded-lg"
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleAssign}
              disabled={!aScopeId || (aTemporary && !aValidUntil) || assignMut.isPending}
              className="w-full rounded-lg bg-provider text-white"
            >
              {assignMut.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Assign <ArrowRight size={14} className="ml-1" />
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Remove confirm */}
      <AlertDialog
        open={!!removeConfirm}
        onOpenChange={(o) => !o && setRemoveConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove coach?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeConfirm?.full_name} will lose access immediately. Their attendance and
              payment-reminder history will be preserved for audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />
      <PremiumGate
        featureName="Coaches"
        featureDescription="Invite coaches to manage your batches and mark attendance — Premium only"
        fallback={
          <div className="mx-auto w-full max-w-lg px-4 py-6">
            <Card
              className="cursor-pointer border-dashed border-amber-200 p-5 text-center hover:bg-amber-50/50"
              onClick={() => setUpgradeOpen(true)}
            >
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                <Crown size={18} className="text-amber-500" />
              </div>
              <p className="text-sm font-semibold">Coaches is a Premium feature</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Onboard multiple coaches to manage batches &amp; mark attendance.
              </p>
              <Button className="mt-3 bg-amber-500 text-white hover:bg-amber-600">
                <Crown size={14} className="mr-1" /> Upgrade to Premium
              </Button>
            </Card>
          </div>
        }
      >
        {content}
      </PremiumGate>

      <UpgradeRequestSheet open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
};

export default CoachesManagement;
