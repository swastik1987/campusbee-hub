import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  useFamilyLinks,
  useSendFamilyInvite,
  useSentInvites,
  useCancelInvite,
  useUnlinkFromFamily,
  useTransferPrimary,
} from "@/hooks/useFamilyLinking";
import { useAddFamilyMembers, calculateAgeGroup } from "@/hooks/useOnboarding";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Copy,
  Crown,
  Loader2,
  LogOut,
  Plus,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const RELATIONSHIP_OPTIONS = [
  "spouse", "child", "parent", "sibling", "grandparent",
  "grandchild", "other",
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const FamilyManagement = () => {
  const { profile, family, familyMembers, familyRole, refreshFamily } = useUser();

  const { data: linkData, isLoading: linksLoading } = useFamilyLinks(profile?.id);
  const { data: sentInvites, isLoading: invitesLoading } = useSentInvites(profile?.id);
  const sendInvite = useSendFamilyInvite();
  const cancelInvite = useCancelInvite();
  const unlinkMutation = useUnlinkFromFamily();
  const transferPrimary = useTransferPrimary();
  const addMembers = useAddFamilyMembers();

  // ── Add Member sheet ──────────────────────────────────────────
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberRelationship, setMemberRelationship] = useState("");
  const [memberDob, setMemberDob] = useState("");
  const [memberGender, setMemberGender] = useState("");

  const handleAddMember = async () => {
    if (!family || !memberName.trim() || !memberRelationship) return;
    const ageGroup = memberDob ? calculateAgeGroup(memberDob) : null;
    try {
      await addMembers.mutateAsync([
        {
          family_id: family.id,
          full_name: memberName.trim(),
          date_of_birth: memberDob || null,
          age_group: ageGroup,
          relationship: memberRelationship,
          gender: memberGender || null,
        },
      ]);
      toast.success("Family member added!");
      setShowAddSheet(false);
      setMemberName("");
      setMemberRelationship("");
      setMemberDob("");
      setMemberGender("");
      refreshFamily();
    } catch {
      toast.error("Failed to add family member");
    }
  };

  // ── Delete member ─────────────────────────────────────────────
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<{
    id: string; name: string;
  } | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const handleDeleteMember = async () => {
    if (!confirmDeleteMember) return;
    setDeletePending(true);
    try {
      const { error } = await supabase.rpc("delete_family_member", {
        p_member_id: confirmDeleteMember.id,
      });
      if (error) throw error;
      toast.success(`${confirmDeleteMember.name} removed from family`);
      setConfirmDeleteMember(null);
      refreshFamily();
    } catch {
      toast.error("Failed to remove family member");
    } finally {
      setDeletePending(false);
    }
  };

  // ── Invite sheet ──────────────────────────────────────────────
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [inviteContact, setInviteContact] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");

  const handleSendInvite = async () => {
    if (!profile || !family) return;
    const isEmail = inviteContact.includes("@");
    try {
      const result = await sendInvite.mutateAsync({
        familyId: family.id,
        invitedBy: profile.id,
        invitedPhone: !isEmail && inviteContact ? inviteContact : undefined,
        invitedEmail: isEmail ? inviteContact : undefined,
        message: inviteMessage.trim() || undefined,
      });
      toast.success("Invite sent!");
      const shareText = `Join our family on CampusBee! Use invite code: ${result.invite_code}`;
      if (navigator.share) {
        navigator.share({ title: "CampusBee Family Invite", text: shareText }).catch(() => {});
      } else {
        navigator.clipboard.writeText(result.invite_code);
        toast.success("Invite code copied to clipboard");
      }
      setShowInviteSheet(false);
      setInviteContact("");
      setInviteMessage("");
    } catch {
      toast.error("Failed to send invite");
    }
  };

  // ── Unlink / Transfer dialogs ─────────────────────────────────
  const [confirmUnlink, setConfirmUnlink] = useState<{
    linkId: string; userName: string; isSelf: boolean;
  } | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<{
    linkId: string; userName: string;
  } | null>(null);

  const linkedUsers = linkData?.linkedUsers ?? [];

  const handleCancel = async (id: string) => {
    try {
      await cancelInvite.mutateAsync(id);
      toast.success("Invite cancelled");
    } catch {
      toast.error("Failed to cancel");
    }
  };

  const handleUnlink = async () => {
    if (!confirmUnlink || !profile) return;
    try {
      await unlinkMutation.mutateAsync({ linkId: confirmUnlink.linkId, unlinkedBy: profile.id });
      toast.success(confirmUnlink.isSelf ? "You have left the family" : "Member removed");
      setConfirmUnlink(null);
      refreshFamily();
    } catch {
      toast.error("Failed to unlink");
    }
  };

  const handleTransfer = async () => {
    if (!confirmTransfer || !linkData?.myLink) return;
    try {
      await transferPrimary.mutateAsync({
        currentPrimaryLinkId: linkData.myLink.id,
        newPrimaryLinkId: confirmTransfer.linkId,
      });
      toast.success(`Primary role transferred to ${confirmTransfer.userName}`);
      setConfirmTransfer(null);
      refreshFamily();
    } catch {
      toast.error("Failed to transfer");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-6">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users size={20} /> Manage Family
        </h2>

        {/* Section 1: Family Members */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Family Members</p>
            {family && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={() => setShowAddSheet(true)}
              >
                <Plus size={13} /> Add Member
              </Button>
            )}
          </div>
          {familyMembers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">No family members added yet</p>
              {family && (
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => setShowAddSheet(true)}
                >
                  <Plus size={14} /> Add Family Member
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {familyMembers.map((m) => (
                <Card key={m.id} className="p-3 flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {(m.full_name ?? "")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.full_name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {m.relationship}{m.age_group && ` · ${m.age_group}`}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                    title="Remove family member"
                    onClick={() => setConfirmDeleteMember({
                      id: m.id,
                      name: m.full_name ?? "this member",
                    })}
                  >
                    <Trash2 size={14} />
                  </Button>
                </Card>
              ))}
              {/* Always show "Add more" button below the list */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 mt-1"
                onClick={() => setShowAddSheet(true)}
              >
                <Plus size={14} /> Add Another Member
              </Button>
            </div>
          )}
        </div>

        {/* Section 2: Linked Accounts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Linked Accounts</p>
            {linkedUsers.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{linkedUsers.length + 1} people</Badge>
            )}
          </div>

          {linksLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          ) : (
            <>
              {/* Current user (self) */}
              <Card className="p-3 flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {profile?.full_name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium">{profile?.full_name}</p>
                    <span className="text-[10px] text-muted-foreground">(You)</span>
                    {familyRole === "primary" && (
                      <Crown size={12} className="text-amber-500" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground capitalize">{familyRole}</p>
                </div>
                {familyRole === "member" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-destructive border-destructive gap-1"
                    onClick={() => setConfirmUnlink({
                      linkId: linkData?.myLink?.id ?? "",
                      userName: "yourself",
                      isSelf: true,
                    })}
                  >
                    <LogOut size={12} /> Leave
                  </Button>
                )}
              </Card>

              {/* Other linked users */}
              {linkedUsers.map((lu) => (
                <Card key={lu.linkId} className="p-3 flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={lu.user?.avatar_url} />
                    <AvatarFallback className="bg-muted text-xs">
                      {lu.user?.full_name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{lu.user?.full_name}</p>
                      {lu.role === "primary" && <Crown size={12} className="text-amber-500" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Joined {new Date(lu.linkedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  {familyRole === "primary" && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Transfer primary role"
                        onClick={() => setConfirmTransfer({ linkId: lu.linkId, userName: lu.user?.full_name ?? "" })}
                      >
                        <Crown size={14} className="text-amber-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        title="Remove from family"
                        onClick={() => setConfirmUnlink({
                          linkId: lu.linkId,
                          userName: lu.user?.full_name ?? "this person",
                          isSelf: false,
                        })}
                      >
                        <UserMinus size={14} />
                      </Button>
                    </div>
                  )}
                </Card>
              ))}

              {linkedUsers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No other family accounts linked. Invite someone below!
                </p>
              )}
            </>
          )}
        </div>

        {/* Section 3: Invite linked account */}
        <Button className="w-full gap-2" onClick={() => setShowInviteSheet(true)}>
          <UserPlus size={16} /> Invite Family Account
        </Button>

        {/* Section 4: Pending Sent Invites */}
        {sentInvites && sentInvites.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending Invites Sent</p>
            {sentInvites.map((inv) => {
              const invitee = (inv as any).users?.full_name ?? inv.invited_phone ?? inv.invited_email ?? "Unknown";
              return (
                <Card key={inv.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{invitee}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Code: {inv.invite_code} · Sent {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        navigator.clipboard.writeText(inv.invite_code);
                        toast.success("Code copied");
                      }}
                    >
                      <Copy size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleCancel(inv.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Family Member Sheet ─────────────────────────────── */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Add Family Member</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4 pb-4">
            <div className="space-y-1">
              <Label className="text-xs">Full Name <span className="text-destructive">*</span></Label>
              <Input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="e.g., Priya Sharma"
                className="h-10 rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Relationship <span className="text-destructive">*</span></Label>
              <Select value={memberRelationship} onValueChange={setMemberRelationship}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Date of Birth <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="date"
                value={memberDob}
                onChange={(e) => setMemberDob(e.target.value)}
                className="h-10 rounded-lg"
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Gender <span className="text-muted-foreground">(optional)</span></Label>
              <Select value={memberGender} onValueChange={setMemberGender}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full rounded-lg gap-2"
              onClick={handleAddMember}
              disabled={!memberName.trim() || !memberRelationship || addMembers.isPending}
            >
              {addMembers.isPending
                ? <><Loader2 size={16} className="animate-spin" /> Adding…</>
                : <><Plus size={14} /> Add Member</>
              }
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Invite Account Sheet ────────────────────────────────── */}
      <Sheet open={showInviteSheet} onOpenChange={setShowInviteSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Invite Family Account</SheetTitle></SheetHeader>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Invite another CampusBee user to link their account to your family.
            They can then manage enrollments and view your family plan.
          </p>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Phone or Email</Label>
              <Input
                value={inviteContact}
                onChange={(e) => setInviteContact(e.target.value)}
                placeholder="e.g., 9876543210 or name@email.com"
                className="h-10 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Message (optional)</Label>
              <Input
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Join our family on CampusBee!"
                className="h-10 rounded-lg"
              />
            </div>
            <Button
              onClick={handleSendInvite}
              disabled={!inviteContact.trim() || sendInvite.isPending}
              className="w-full rounded-lg gap-2"
            >
              {sendInvite.isPending
                ? <Loader2 size={16} className="animate-spin" />
                : <><Send size={14} /> Send Invite</>
              }
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Family Member Confirmation */}
      <AlertDialog open={!!confirmDeleteMember} onOpenChange={() => !deletePending && setConfirmDeleteMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDeleteMember?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{confirmDeleteMember?.name}</strong> from your family.
              All active class enrollments will be dropped and their providers will be notified.
              Demo bookings and waitlist spots will also be cancelled. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletePending
                ? <Loader2 size={14} className="animate-spin" />
                : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink Confirmation */}
      <AlertDialog open={!!confirmUnlink} onOpenChange={() => setConfirmUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmUnlink?.isSelf ? "Leave Family?" : `Remove ${confirmUnlink?.userName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUnlink?.isSelf
                ? "You will lose access to all family members, enrollments, and payment history."
                : `${confirmUnlink?.userName} will lose access. All enrollments and payments they made will remain in your family.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {unlinkMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Primary Dialog */}
      <AlertDialog open={!!confirmTransfer} onOpenChange={() => setConfirmTransfer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Primary Role?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTransfer?.userName} will become the primary family manager.
              You will become a regular member.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransfer}>
              {transferPrimary.isPending ? <Loader2 size={14} className="animate-spin" /> : "Transfer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav persona="seeker" />
    </div>
  );
};

export default FamilyManagement;
