import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  useModerationQueue,
  useResolveModerationFlag,
} from "@/hooks/usePlatformAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CheckCircle,
  Clock,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type FlagStatus = "in_review" | "approved" | "rejected";

const STATUS_TABS: { label: string; value: FlagStatus }[] = [
  { label: "Queue", value: "in_review" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const REF_TYPE_LABELS: Record<string, string> = {
  class_image: "Class Image",
  class_text: "Class Text",
  provider_avatar: "Instructor Avatar",
  provider_bio: "Instructor Bio",
  banner: "Banner",
};

function scoreBadge(score: number | null) {
  if (score == null) return null;
  if (score >= 0.85) return { label: `${score.toFixed(2)} — High`, cls: "bg-red-100 text-red-700" };
  if (score >= 0.45) return { label: `${score.toFixed(2)} — Medium`, cls: "bg-amber-100 text-amber-700" };
  return { label: `${score.toFixed(2)} — Low`, cls: "bg-green-100 text-green-700" };
}

const PlatformModeration = () => {
  const { profile } = useUser();
  const [activeTab, setActiveTab] = useState<FlagStatus>("in_review");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: flags, isLoading, error, refetch } = useModerationQueue(activeTab);
  const resolve = useResolveModerationFlag();

  const handleApprove = async (flagId: string) => {
    if (!profile) return;
    try {
      await resolve.mutateAsync({ flagId, action: "approved", reviewedBy: profile.id });
      toast.success("Content approved");
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !profile) return;
    try {
      await resolve.mutateAsync({
        flagId: rejectingId,
        action: "rejected",
        reviewedBy: profile.id,
        actionNotes: rejectNotes || undefined,
      });
      toast.success("Content rejected");
      setRejectingId(null);
      setRejectNotes("");
    } catch {
      toast.error("Failed to reject");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Content Moderation</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Review AI-flagged content before it goes public
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">Failed to load flags</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : !flags?.length ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <ShieldCheck size={44} className="text-green-500" />
          <p className="text-sm font-semibold">
            {activeTab === "in_review" ? "Queue is clear!" : `No ${activeTab} items`}
          </p>
          <p className="text-xs text-muted-foreground">All content has been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(flags ?? []).map((flag: any) => {
            const score = scoreBadge(flag.ai_score);
            return (
              <Card key={flag.id} className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {REF_TYPE_LABELS[flag.ref_type] ?? flag.ref_type}
                    </Badge>
                    {flag.ai_provider && (
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {flag.ai_provider}
                      </span>
                    )}
                    {score && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${score.cls}`}>
                        {score.label}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                    <Clock size={10} />
                    {new Date(flag.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Image preview */}
                {flag.image_url && (
                  <div className="rounded-lg overflow-hidden border w-fit">
                    <img
                      src={flag.image_url}
                      alt="Flagged content"
                      className="h-32 max-w-[240px] object-cover"
                    />
                  </div>
                )}

                {/* Text preview */}
                {flag.content_snapshot && (
                  <div className="rounded-lg bg-muted/60 px-3 py-2">
                    <p className="text-xs text-foreground/80 line-clamp-4 leading-relaxed">
                      {flag.content_snapshot}
                    </p>
                  </div>
                )}

                {/* Resolution notes */}
                {flag.action_notes && (
                  <p className="text-xs text-muted-foreground italic">
                    Notes: {flag.action_notes}
                  </p>
                )}

                {/* Reviewed badge */}
                {flag.reviewed_at && activeTab !== "in_review" && (
                  <p className="text-[10px] text-muted-foreground">
                    Reviewed {new Date(flag.reviewed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                  </p>
                )}

                {/* Actions — only in queue */}
                {activeTab === "in_review" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => handleApprove(flag.id)}
                      disabled={resolve.isPending}
                    >
                      <CheckCircle size={14} />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => { setRejectingId(flag.id); setRejectNotes(""); }}
                      disabled={resolve.isPending}
                    >
                      <XCircle size={14} />
                      Reject
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject sheet */}
      <Sheet
        open={!!rejectingId}
        onOpenChange={(open) => { if (!open) { setRejectingId(null); setRejectNotes(""); } }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle>Reject Content</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Notes{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Describe why this content is rejected…"
                rows={3}
                className="resize-none"
              />
            </div>
            <Button
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              onClick={handleReject}
              disabled={resolve.isPending}
            >
              {resolve.isPending && <Loader2 size={16} className="animate-spin" />}
              Confirm Rejection
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PlatformModeration;
