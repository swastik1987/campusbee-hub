import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useInviteByCode, useAcceptInvite, useRejectInvite } from "@/hooks/useFamilyLinking";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Check, Clock, Loader2, Merge, Users, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const InviteAccept = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { profile, family, familyMembers, loading: userLoading, refreshFamily } = useUser();

  const { data: invite, isLoading, isError } = useInviteByCode(inviteCode);
  const acceptInvite = useAcceptInvite();
  const rejectInvite = useRejectInvite();

  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

  // If not logged in, redirect to auth with return URL
  useEffect(() => {
    if (!userLoading && !profile) {
      navigate(`/auth?redirect=/invite/${inviteCode}`);
    }
  }, [userLoading, profile, navigate, inviteCode]);

  if (userLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!invite || isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm p-6 text-center space-y-4">
          <AlertTriangle size={32} className="text-muted-foreground mx-auto" />
          <h2 className="text-lg font-bold">Invalid Invite</h2>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid or could not be found.
          </p>
          <Button onClick={() => navigate("/home")} className="w-full">Go Home</Button>
        </Card>
      </div>
    );
  }

  if (invite.status === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm p-6 text-center space-y-4">
          <Clock size={32} className="text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold">Invite Expired</h2>
          <p className="text-sm text-muted-foreground">
            This invite has expired. Ask the person to send you a new one.
          </p>
          <Button onClick={() => navigate("/home")} className="w-full">Go Home</Button>
        </Card>
      </div>
    );
  }

  if (invite.status !== "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm p-6 text-center space-y-4">
          <Check size={32} className="text-green-600 mx-auto" />
          <h2 className="text-lg font-bold">Invite Already Used</h2>
          <p className="text-sm text-muted-foreground">
            This invite has already been {invite.status}.
          </p>
          <Button onClick={() => navigate("/home")} className="w-full">Go Home</Button>
        </Card>
      </div>
    );
  }

  const inviter = invite.inviter as any;
  const aptName = (invite.families as any)?.apartment_complexes?.name ?? "their apartment";

  // Check if user needs to merge
  const needsMerge = family && family.id !== invite.family_id;

  const handleAccept = async () => {
    if (!profile) return;

    if (needsMerge) {
      setShowMergeConfirm(true);
      return;
    }

    try {
      await acceptInvite.mutateAsync({
        inviteId: invite.id,
        userId: profile.id,
        familyId: invite.family_id,
      });
      toast.success("You've joined the family!");
      refreshFamily();
      navigate("/family");
    } catch {
      toast.error("Failed to accept invite");
    }
  };

  const handleMergeAccept = async () => {
    if (!profile || !family) return;
    try {
      await acceptInvite.mutateAsync({
        inviteId: invite.id,
        userId: profile.id,
        familyId: invite.family_id,
        mergeOldFamilyId: family.id,
      });
      toast.success("Families merged! You've joined the family.");
      setShowMergeConfirm(false);
      refreshFamily();
      navigate("/family");
    } catch {
      toast.error("Failed to merge families");
    }
  };

  const handleReject = async () => {
    try {
      await rejectInvite.mutateAsync(invite.id);
      toast.success("Invite declined");
      navigate("/home");
    } catch {
      toast.error("Failed to decline");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex justify-center">
          <img src="/logo-full.png" alt="CampusBee" className="h-14 object-contain" />
        </div>

        <Card className="p-6 space-y-4">
          <div className="text-center space-y-3">
            <Avatar className="h-14 w-14 mx-auto">
              <AvatarImage src={inviter?.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {inviter?.full_name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-base font-bold">{inviter?.full_name}</h2>
              <p className="text-sm text-muted-foreground">
                invited you to join their family
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                at {aptName}
              </p>
            </div>
          </div>

          {invite.message && (
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground italic">"{invite.message}"</p>
            </div>
          )}

          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Users size={14} className="text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800">
                Joining will give you shared access to family members, enrollments, payments, and attendance within this family.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-1"
              onClick={handleReject}
              disabled={rejectInvite.isPending}
            >
              {rejectInvite.isPending ? <Loader2 size={14} className="animate-spin" /> : <><X size={14} /> Decline</>}
            </Button>
            <Button
              className="flex-1 gap-1"
              onClick={handleAccept}
              disabled={acceptInvite.isPending}
            >
              {acceptInvite.isPending ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Accept</>}
            </Button>
          </div>
        </Card>
      </div>

      {/* Merge Confirmation Dialog */}
      <AlertDialog open={showMergeConfirm} onOpenChange={setShowMergeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Merge size={18} /> Merge Families?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You already have a family set up in {aptName}. Joining {inviter?.full_name}'s
                family will merge your family members and enrollments.
              </p>
              {familyMembers.length > 0 && (
                <div className="bg-muted rounded-lg p-3 mt-2">
                  <p className="text-xs font-semibold mb-1">Your family members:</p>
                  {familyMembers.map((m) => (
                    <p key={m.id} className="text-xs text-foreground">{m.name} ({m.relationship})</p>
                  ))}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMergeAccept}>
              {acceptInvite.isPending ? <Loader2 size={14} className="animate-spin" /> : "Merge & Join"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InviteAccept;
