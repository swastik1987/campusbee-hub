import React, { useMemo, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  useModerationQueue,
  useResolveModerationFlag,
} from "@/hooks/usePlatformAdmin";
import {
  useCertificationModerationQueue,
  useBulkApproveCertifications,
  type CertModerationItem,
} from "@/hooks/useCertifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertTriangle,
  Award,
  CheckCircle,
  CheckCircle2,
  Clock,
  FileCheck,
  Loader2,
  ShieldCheck,
  User,
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
  class_title: "Class Title",
  class_description: "Class Description",
  provider_avatar: "Instructor Avatar",
  provider_bio: "Instructor Bio",
  banner: "Banner",
  certification: "Certification",
};

function scoreBadge(score: number | null) {
  if (score == null) return null;
  if (score >= 0.85) return { label: `${score.toFixed(2)} — High`, cls: "bg-red-100 text-red-700" };
  if (score >= 0.45) return { label: `${score.toFixed(2)} — Medium`, cls: "bg-amber-100 text-amber-700" };
  return { label: `${score.toFixed(2)} — Low`, cls: "bg-green-100 text-green-700" };
}

// ── Certification AI verdict reader ───────────────────────────────────────────
// Shape mirrors the JSON written by the edge function in ai_categories.

type GeminiVisionVerdict = {
  is_certificate?: boolean;
  verdict?: "genuine" | "suspicious" | "not_a_certificate";
  confidence?: "high" | "medium" | "low";
  issuer_text?: string | null;
  recipient_text?: string | null;
  issue_date_text?: string | null;
  tampering_signals?: string[];
  policy_violations?: string[];
  reasoning?: string;
};

function extractGeminiVerdict(categories: Record<string, unknown> | null): GeminiVisionVerdict | null {
  if (!categories) return null;
  const cv = (categories as any).gemini_vision;
  if (!cv || typeof cv !== "object") return null;
  return cv as GeminiVisionVerdict;
}

function verdictBadge(verdict: GeminiVisionVerdict | null) {
  if (!verdict?.verdict) return null;
  if (verdict.verdict === "genuine")
    return { label: "AI: Genuine", cls: "bg-green-100 text-green-700" };
  if (verdict.verdict === "suspicious")
    return { label: "AI: Suspicious", cls: "bg-amber-100 text-amber-700" };
  return { label: "AI: Not a Certificate", cls: "bg-red-100 text-red-700" };
}

// ─────────────────────────────────────────────────────────────────────────────

const PlatformModeration = () => {
  const { profile } = useUser();
  const [activeTab, setActiveTab] = useState<FlagStatus>("in_review");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: flags, isLoading, error, refetch } = useModerationQueue(activeTab);
  const { data: certQueue } = useCertificationModerationQueue();
  const resolve = useResolveModerationFlag();
  const bulkApprove = useBulkApproveCertifications();

  // Selected cert ids (for bulk approve). Keyed by flag_id.
  const [selectedCertFlagIds, setSelectedCertFlagIds] = useState<Set<string>>(new Set());

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

  // Group cert queue by provider for bulk approve action
  const certGroups = useMemo(() => {
    if (!certQueue) return [] as Array<{
      providerId: string;
      providerLabel: string;
      items: CertModerationItem[];
    }>;
    const map = new Map<string, { providerId: string; providerLabel: string; items: CertModerationItem[] }>();
    for (const item of certQueue) {
      const key = item.provider_id;
      const label = item.provider_business_name ?? item.provider_user_name ?? "Unknown provider";
      const existing = map.get(key);
      if (existing) existing.items.push(item);
      else map.set(key, { providerId: key, providerLabel: label, items: [item] });
    }
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [certQueue]);

  const certByFlagId = useMemo(() => {
    const map = new Map<string, CertModerationItem>();
    for (const c of certQueue ?? []) map.set(c.flag_id, c);
    return map;
  }, [certQueue]);

  const toggleCertSelect = (flagId: string) => {
    setSelectedCertFlagIds((prev) => {
      const next = new Set(prev);
      if (next.has(flagId)) next.delete(flagId);
      else next.add(flagId);
      return next;
    });
  };

  const handleBulkApprove = async (providerId: string) => {
    const certIds = (certQueue ?? [])
      .filter((c) => selectedCertFlagIds.has(c.flag_id) && c.provider_id === providerId)
      .map((c) => c.cert_id);
    if (certIds.length === 0) {
      toast.error("Select at least one certification to approve");
      return;
    }
    try {
      const res = await bulkApprove.mutateAsync({ providerId, certIds });
      toast.success(
        `Approved ${res.approved}${res.skipped > 0 ? ` (${res.skipped} skipped)` : ""}`,
      );
      setSelectedCertFlagIds((prev) => {
        const next = new Set(prev);
        for (const id of certIds) {
          // remove all flags that mapped to these cert ids
          for (const c of certQueue ?? []) {
            if (c.cert_id === id) next.delete(c.flag_id);
          }
        }
        return next;
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Bulk approval failed");
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

      {/* Per-provider bulk-approve banners (only when on Queue) */}
      {activeTab === "in_review" && certGroups.length > 0 && (
        <div className="space-y-2">
          {certGroups.map((g) => {
            const selectedHere = g.items.filter((i) => selectedCertFlagIds.has(i.flag_id)).length;
            return (
              <Card key={g.providerId} className="p-3 flex items-center justify-between gap-3 flex-wrap bg-amber-50/40 border-amber-200">
                <div className="text-xs flex items-center gap-2">
                  <Award size={14} className="text-amber-600" />
                  <span className="font-semibold">{g.providerLabel}</span>
                  <span className="text-muted-foreground">
                    · {g.items.length} certification{g.items.length === 1 ? "" : "s"} pending
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-100"
                  disabled={bulkApprove.isPending || selectedHere === 0}
                  onClick={() => handleBulkApprove(g.providerId)}
                >
                  {bulkApprove.isPending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  Bulk Approve ({selectedHere})
                </Button>
              </Card>
            );
          })}
        </div>
      )}

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
            const isCert = flag.ref_type === "certification";
            const certCtx = isCert ? certByFlagId.get(flag.id) : null;
            const verdict = isCert ? extractGeminiVerdict(flag.ai_categories) : null;
            const vBadge = isCert ? verdictBadge(verdict) : null;
            const score = scoreBadge(flag.ai_score);
            return (
              <Card key={flag.id} className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isCert && activeTab === "in_review" && (
                      <Checkbox
                        checked={selectedCertFlagIds.has(flag.id)}
                        onCheckedChange={() => toggleCertSelect(flag.id)}
                      />
                    )}
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
                    {vBadge && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${vBadge.cls}`}>
                        {vBadge.label}
                      </span>
                    )}
                    {isCert && verdict?.confidence && (
                      <span className="text-[10px] uppercase text-muted-foreground">
                        conf: {verdict.confidence}
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

                {/* Certification context */}
                {isCert && certCtx && (
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 space-y-1">
                    <div className="text-xs flex items-center gap-1.5 font-semibold">
                      <Award size={12} /> {certCtx.name}
                      {certCtx.issuing_authority && (
                        <span className="font-normal text-muted-foreground">
                          · {certCtx.issuing_authority}
                          {certCtx.year_obtained ? ` (${certCtx.year_obtained})` : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <User size={10} />
                      {certCtx.provider_business_name ?? certCtx.provider_user_name ?? "Unknown provider"}
                      {certCtx.owner_type === "trainer" && certCtx.trainer_name && (
                        <span> · Trainer: {certCtx.trainer_name}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Image preview */}
                {flag.image_url && (
                  <div className="rounded-lg overflow-hidden border w-fit">
                    <img
                      src={flag.image_url}
                      alt="Flagged content"
                      className={isCert ? "h-56 max-w-[400px] object-contain bg-white" : "h-32 max-w-[240px] object-cover"}
                    />
                  </div>
                )}

                {/* Gemini Vision analysis (cert only) */}
                {isCert && verdict && (
                  <div className="rounded-lg bg-blue-50/60 border border-blue-200 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                      <FileCheck size={13} /> AI Genuineness Analysis
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-foreground">Issuer: </span>
                        <span className="font-medium">{verdict.issuer_text ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Recipient: </span>
                        <span className="font-medium">{verdict.recipient_text ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Date: </span>
                        <span className="font-medium">{verdict.issue_date_text ?? "—"}</span>
                      </div>
                    </div>
                    {verdict.reasoning && (
                      <p className="text-[11px] text-blue-900/80 italic leading-snug">
                        "{verdict.reasoning}"
                      </p>
                    )}
                    {verdict.tampering_signals && verdict.tampering_signals.length > 0 && (
                      <div className="text-[11px] flex items-start gap-1 text-amber-700">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold">Tampering signals: </span>
                          {verdict.tampering_signals.join("; ")}
                        </div>
                      </div>
                    )}
                    {verdict.policy_violations && verdict.policy_violations.length > 0 && (
                      <div className="text-[11px] flex items-start gap-1 text-red-700">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold">Policy violations: </span>
                          {verdict.policy_violations.join("; ")}
                        </div>
                      </div>
                    )}
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
