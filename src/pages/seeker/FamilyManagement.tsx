import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  useFamilyLinks,
  useSendFamilyInvite,
  useSentInvites,
  useCancelInvite,
  useUnlinkFromFamily,
  useTransferPrimary,
  useSearchApartmentUsers,
} from "@/hooks/useFamilyLinking";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Link2,
  Loader2,
  LogOut,
  Mail,
  Phone,
  Plus,
  Search,
  Send,
  Share2,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const FamilyManagement = () => {
  const { profile, family, familyMembers, currentApartment, familyRole, refreshFamily } = useUser();

  const { data: linkData, isLoading: linksLoading } = useFamilyLinks(profile?.id);
  const { data: sentInvites, isLoading: invitesLoading } = useSentInvites(profile?.id);
  const sendInvite = useSendFamilyInvite();
  const cancelInvite = useCancelInvite();
  const unlinkMutation = useUnlinkFromFamily();
  const transferPrimary = useTransferPrimary();

  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [inviteTab, setInviteTab] = useState("contact");
  const [inviteContact, setInviteContact] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { data: searchResults } = useSearchApartmentUsers(family?.apartment_id, searchTerm);

  const [confirmUnlink, setConfirmUnlink] = useState<{ linkId: string; userName: string; isSelf: boolean } | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<{ linkId: string; userName: string } | null>(null);

  const linkedUsers = linkData?.linkedUsers ?? [];

  const handleSendInvite = async (opts?: { userId?: string }) => {
    if (!profile || !family) return;

    const isEmail = inviteContact.includes("@");
    try {
      const result = await sendInvite.mutateAsync({
        familyId: family.id,
        invitedBy: profile.id,
        invitedUserId: opts?.userId,
        invitedPhone: !isEmail && inviteContact ? inviteContact : undefined,
        invitedEmail: isEmail ? inviteContact : undefined,
        message: inviteMessage.trim() || undefined,
      });
      toast.success("Invite sent!");

      // Offer to share
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

  const handleSearchInvite = async (userId: string) => {
    if (!profile || !family) return;
    try {
      const result = await sendInvite.mutateAsync({
        familyId: family.id,
        invitedBy: profile.id,
        invitedUserId: userId,
      });
      toast.success("Invite sent!");
      setShowInviteSheet(false);
      setSearchTerm("");
    } catch {
      toast.error("Failed to send invite");
    }
  };

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
      await unlinkMutation.mutateAsync({
        linkId: confirmUnlink.linkId,
        unlinkedBy: profile.id,
      });
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Family Members</p>
          {familyMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No family members added yet</p>
          ) : (
            familyMembers.map((m) => (
              <Card key={m.id} className="p-3 flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {m.name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground">{m.relationship} {m.age_group && `· ${m.age_group}`}</p>
                </div>
              </Card>
            ))
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
                  No other family members linked yet. Invite someone below!
                </p>
              )}
            </>
          )}
        </div>

        {/* Section 3: Invite Button */}
        <Button
          className="w-full gap-2"
          onClick={() => setShowInviteSheet(true)}
        >
          <UserPlus size={16} /> Invite Family Member
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

      {/* Invite Sheet */}
      <Sheet open={showInviteSheet} onOpenChange={setShowInviteSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Invite Family Member</SheetTitle></SheetHeader>
          <Tabs value={inviteTab} onValueChange={setInviteTab} className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="contact" className="flex-1 text-xs">By Phone/Email</TabsTrigger>
              <TabsTrigger value="search" className="flex-1 text-xs">From CampusBee</TabsTrigger>
            </TabsList>

            <TabsContent value="contact" className="space-y-4 mt-4">
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
                onClick={() => handleSendInvite()}
                disabled={!inviteContact.trim() || sendInvite.isPending}
                className="w-full rounded-lg gap-2"
              >
                {sendInvite.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Send size={14} /> Send Invite</>}
              </Button>
            </TabsContent>

            <TabsContent value="search" className="space-y-4 mt-4">
              <div className="space-y-1">
                <Label className="text-xs">Search by name in {currentApartment?.name}</Label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search residents..."
                    className="h-10 rounded-lg pl-9"
                  />
                </div>
              </div>

              {searchResults && searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults
                    .filter((u) => u.id !== profile?.id)
                    .map((u) => (
                      <Card key={u.id} className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-muted text-[10px]">
                              {u.full_name?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{u.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => handleSearchInvite(u.id)}
                          disabled={sendInvite.isPending}
                        >
                          {sendInvite.isPending ? <Loader2 size={12} className="animate-spin" /> : <><UserPlus size={12} /> Invite</>}
                        </Button>
                      </Card>
                    ))}
                </div>
              )}

              {searchTerm.length >= 2 && searchResults?.filter((u) => u.id !== profile?.id).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No residents found</p>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Unlink Confirmation Dialog */}
      <AlertDialog open={!!confirmUnlink} onOpenChange={() => setConfirmUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmUnlink?.isSelf ? "Leave Family?" : `Remove ${confirmUnlink?.userName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUnlink?.isSelf
                ? "You will lose access to all family members, enrollments, and payment history. Enrollments and payments you made will remain visible to other family members."
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
              {confirmTransfer?.userName} will become the primary family manager. You will become a regular member and can leave the family afterwards if you choose.
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
