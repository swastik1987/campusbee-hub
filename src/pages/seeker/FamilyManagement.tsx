import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Copy, Crown, Loader2, LogOut, Plus, Send, Trash2, UserMinus, UserPlus, Users,
} from "lucide-react";
import { toast } from "sonner";

const RELATIONSHIP_OPTIONS = ["spouse", "child", "parent", "sibling", "grandparent", "grandchild", "other"];
const GENDER_OPTIONS = [
  { value: "male",            label: "Male" },
  { value: "female",          label: "Female" },
  { value: "other",           label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const FamilyManagement = () => {
  const { profile, family, familyMembers, familyRole, refreshFamily } = useUser();
  const navigate = useNavigate();

  const { data: linkData, isLoading: linksLoading } = useFamilyLinks(profile?.id);
  const { data: sentInvites } = useSentInvites(profile?.id);
  const sendInvite    = useSendFamilyInvite();
  const cancelInvite  = useCancelInvite();
  const unlinkMutation = useUnlinkFromFamily();
  const transferPrimary = useTransferPrimary();
  const addMembers    = useAddFamilyMembers();

  // ── Add Member sheet ────────────────────────────────────────────
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberRelationship, setMemberRelationship] = useState("");
  const [memberDob, setMemberDob] = useState("");
  const [memberGender, setMemberGender] = useState("");

  const handleAddMember = async () => {
    if (!family || !memberName.trim() || !memberRelationship) return;
    const ageGroup = memberDob ? calculateAgeGroup(memberDob) : null;
    try {
      await addMembers.mutateAsync([{
        family_id: family.id,
        full_name: memberName.trim(),
        date_of_birth: memberDob || null,
        age_group: ageGroup,
        relationship: memberRelationship,
        gender: memberGender || null,
      }]);
      toast.success("Family member added!");
      setShowAddSheet(false);
      setMemberName(""); setMemberRelationship(""); setMemberDob(""); setMemberGender("");
      refreshFamily();
    } catch { toast.error("Failed to add family member"); }
  };

  // ── Delete member ───────────────────────────────────────────────
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<{ id: string; name: string } | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const handleDeleteMember = async () => {
    if (!confirmDeleteMember) return;
    setDeletePending(true);
    try {
      const { error } = await supabase.rpc("delete_family_member", { p_member_id: confirmDeleteMember.id });
      if (error) throw error;
      toast.success(`${confirmDeleteMember.name} removed`);
      setConfirmDeleteMember(null);
      refreshFamily();
    } catch { toast.error("Failed to remove"); }
    finally { setDeletePending(false); }
  };

  // ── Invite sheet ────────────────────────────────────────────────
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
        toast.success("Invite code copied");
      }
      setShowInviteSheet(false);
      setInviteContact(""); setInviteMessage("");
    } catch { toast.error("Failed to send invite"); }
  };

  // ── Unlink / Transfer ───────────────────────────────────────────
  const [confirmUnlink, setConfirmUnlink] = useState<{ linkId: string; userName: string; isSelf: boolean } | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<{ linkId: string; userName: string } | null>(null);

  const linkedUsers = linkData?.linkedUsers ?? [];

  const handleCancel = async (id: string) => {
    try { await cancelInvite.mutateAsync(id); toast.success("Invite cancelled"); }
    catch { toast.error("Failed to cancel"); }
  };

  const handleUnlink = async () => {
    if (!confirmUnlink || !profile) return;
    try {
      await unlinkMutation.mutateAsync({ linkId: confirmUnlink.linkId, unlinkedBy: profile.id });
      toast.success(confirmUnlink.isSelf ? "You have left the family" : "Member removed");
      setConfirmUnlink(null); refreshFamily();
    } catch { toast.error("Failed to unlink"); }
  };

  const handleTransfer = async () => {
    if (!confirmTransfer || !linkData?.myLink) return;
    try {
      await transferPrimary.mutateAsync({
        currentPrimaryLinkId: linkData.myLink.id,
        newPrimaryLinkId: confirmTransfer.linkId,
      });
      toast.success(`Primary role transferred to ${confirmTransfer.userName}`);
      setConfirmTransfer(null); refreshFamily();
    } catch { toast.error("Failed to transfer"); }
  };

  // Derived groups
  const children = familyMembers.filter((m) => m.relationship === "child" || m.relationship === "grandchild");
  const otherMembers = familyMembers.filter((m) => m.relationship !== "child" && m.relationship !== "grandchild");
  const coPareents = linkedUsers; // linked adult accounts

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-bold">Family</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-5 space-y-6">

        {/* ── Primary Parent ──────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Primary Parent</p>
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {profile?.full_name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{profile?.full_name}</p>
                <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-white uppercase">YOU</span>
                {familyRole === "primary" && <Crown size={12} className="text-amber-500" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            </div>
          </div>
        </div>

        {/* ── Co-parents / Linked Accounts ───────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Co-parents</p>
            <button
              onClick={() => setShowInviteSheet(true)}
              className="flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Plus size={13} /> Add
            </button>
          </div>

          {linksLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          ) : coPareents.length === 0 ? (
            <button
              onClick={() => setShowInviteSheet(true)}
              className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 p-4 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                <UserPlus size={18} className="text-primary/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">Invite a co-parent</p>
                <p className="text-xs text-muted-foreground">They can manage enrollments together</p>
              </div>
            </button>
          ) : (
            <div className="space-y-2">
              {coPareents.map((lu) => (
                <div key={lu.linkId} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={lu.user?.avatar_url} />
                    <AvatarFallback className="bg-muted text-sm">
                      {lu.user?.full_name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{lu.user?.full_name}</p>
                      {lu.role === "primary" && <Crown size={11} className="text-amber-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(lu.linkedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  {familyRole === "primary" && (
                    <div className="flex gap-1">
                      <button
                        title="Transfer primary role"
                        onClick={() => setConfirmTransfer({ linkId: lu.linkId, userName: lu.user?.full_name ?? "" })}
                        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-amber-50"
                      >
                        <Crown size={15} className="text-amber-500" />
                      </button>
                      <button
                        title="Remove"
                        onClick={() => setConfirmUnlink({ linkId: lu.linkId, userName: lu.user?.full_name ?? "this person", isSelf: false })}
                        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-50 text-destructive"
                      >
                        <UserMinus size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => setShowInviteSheet(true)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/30 py-3 text-xs font-semibold text-primary"
              >
                <Plus size={13} /> Add Co-parent
              </button>
            </div>
          )}

          {familyRole !== "primary" && linkData?.myLink && (
            <button
              onClick={() => setConfirmUnlink({ linkId: linkData.myLink!.id, userName: "yourself", isSelf: true })}
              className="flex items-center gap-2 text-xs text-destructive font-medium py-1"
            >
              <LogOut size={13} /> Leave family
            </button>
          )}
        </div>

        {/* ── Children ───────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Children</p>
            {family && (
              <button
                onClick={() => { setMemberRelationship("child"); setShowAddSheet(true); }}
                className="flex items-center gap-1 text-xs font-semibold text-primary"
              >
                <Plus size={13} /> Add
              </button>
            )}
          </div>

          {children.length === 0 ? (
            <button
              onClick={() => { setMemberRelationship("child"); setShowAddSheet(true); }}
              className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 p-4 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                <Plus size={18} className="text-primary/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">Add a child</p>
                <p className="text-xs text-muted-foreground">Track their classes and attendance</p>
              </div>
            </button>
          ) : (
            <div className="space-y-2">
              {children.map((child) => {
                const initials = child.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";
                return (
                  <div key={child.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{child.full_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground capitalize">{child.relationship}</span>
                        {(child as any).age_group && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary capitalize">
                            {(child as any).age_group}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmDeleteMember({ id: child.id, name: child.full_name ?? "this child" })}
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-50 text-destructive flex-shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => { setMemberRelationship("child"); setShowAddSheet(true); }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/30 py-3 text-xs font-semibold text-primary"
              >
                <Plus size={13} /> Add Child
              </button>
            </div>
          )}
        </div>

        {/* ── Other family members ────────────────────────────────── */}
        {otherMembers.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Other Members</p>
            {otherMembers.map((m) => (
              <div key={m.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-muted text-sm">
                    {(m.full_name ?? "")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.relationship}</p>
                </div>
                <button
                  onClick={() => setConfirmDeleteMember({ id: m.id, name: m.full_name ?? "this member" })}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-50 text-destructive flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add any member button when family has no members */}
        {family && familyMembers.length === 0 && (
          <Button className="w-full gradient-primary text-white rounded-xl gap-2" onClick={() => setShowAddSheet(true)}>
            <Plus size={16} /> Add Family Member
          </Button>
        )}

        {/* ── Pending sent invites ────────────────────────────────── */}
        {sentInvites && sentInvites.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pending Invites Sent</p>
            {sentInvites.map((inv) => {
              const invitee = (inv as any).users?.full_name ?? inv.invited_phone ?? inv.invited_email ?? "Unknown";
              return (
                <div key={inv.id} className="rounded-2xl border border-border bg-card p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{invitee}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Code: {inv.invite_code} · Sent {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => { navigator.clipboard.writeText(inv.invite_code); toast.success("Code copied"); }}
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
                    >
                      <Copy size={14} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleCancel(inv.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-50 text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Family Member Sheet ─────────────────────────────────── */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Add Family Member</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4 pb-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Full Name <span className="text-destructive">*</span></Label>
              <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="e.g., Priya Sharma" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Relationship <span className="text-destructive">*</span></Label>
              <Select value={memberRelationship} onValueChange={setMemberRelationship}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select relationship" /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Date of Birth <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="date" value={memberDob} onChange={(e) => setMemberDob(e.target.value)} className="h-11 rounded-xl" max={new Date().toISOString().split("T")[0]} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Gender <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={memberGender} onValueChange={setMemberGender}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full h-12 gradient-primary text-white rounded-xl gap-2" onClick={handleAddMember} disabled={!memberName.trim() || !memberRelationship || addMembers.isPending}>
              {addMembers.isPending ? <><Loader2 size={16} className="animate-spin" /> Adding…</> : <><Plus size={14} /> Add Member</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Invite Account Sheet ─────────────────────────────────────── */}
      <Sheet open={showInviteSheet} onOpenChange={setShowInviteSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Invite Co-parent</SheetTitle></SheetHeader>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Invite another CampusBee user to manage your family's classes together.</p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Phone or Email</Label>
              <Input value={inviteContact} onChange={(e) => setInviteContact(e.target.value)} placeholder="9876543210 or name@email.com" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} placeholder="Join our family on CampusBee!" className="h-11 rounded-xl" />
            </div>
            <Button className="w-full h-12 gradient-primary text-white rounded-xl gap-2" onClick={handleSendInvite} disabled={!inviteContact.trim() || sendInvite.isPending}>
              {sendInvite.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Send size={14} /> Send Invite</>}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Member Confirm */}
      <AlertDialog open={!!confirmDeleteMember} onOpenChange={() => !deletePending && setConfirmDeleteMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDeleteMember?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{confirmDeleteMember?.name}</strong> from your family. All active enrollments will be dropped and providers notified. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember} className="bg-destructive text-white hover:bg-destructive/90">
              {deletePending ? <Loader2 size={14} className="animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink Confirm */}
      <AlertDialog open={!!confirmUnlink} onOpenChange={() => setConfirmUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmUnlink?.isSelf ? "Leave Family?" : `Remove ${confirmUnlink?.userName}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUnlink?.isSelf ? "You will lose access to all family members, enrollments, and history." : `${confirmUnlink?.userName} will lose access. Their activity history stays in the family.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlink} className="bg-destructive text-white hover:bg-destructive/90">
              {unlinkMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Primary Confirm */}
      <AlertDialog open={!!confirmTransfer} onOpenChange={() => setConfirmTransfer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Primary Role?</AlertDialogTitle>
            <AlertDialogDescription>{confirmTransfer?.userName} will become the primary family manager. You will become a regular member.</AlertDialogDescription>
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
