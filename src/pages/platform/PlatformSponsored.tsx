/**
 * /platform/sponsored — Phase 8 platform admin surface (unified feed).
 *
 * Top tabs:  Pending | Active | Rejected   (by status)
 * Inline filter: All / Sponsored / Banner — Home / Banner — Explore
 *
 * "Active" tab queries status IN ('approved','active') so a row stays visible
 * between admin approval and the next refresh-sponsored-slots cron tick
 * (which flips approved → active when valid_from <= now()).
 *
 * Sponsored listings and featured banners are merged into a single chronologically-
 * ordered list per tab.  Each card renders surface-appropriate UI; approve/reject
 * sheets dispatch to the right mutation based on item type.
 */

import { useMemo, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  usePlatformSponsoredRequests,
  useApproveSponsored,
  useRejectSponsored,
  usePlatformBannerRequests,
  useApproveFeaturedBanner,
  useRejectFeaturedBanner,
  useRefreshSponsoredSlots,
  type RefreshSponsoredResult,
} from "@/hooks/usePlatformAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, MapPin, Megaphone, RefreshCw, Sparkles, Target, TrendingUp, XCircle } from "lucide-react";
import { toast } from "sonner";

// ── Tab / filter model ───────────────────────────────────────────────────────

type StatusTab = "pending" | "active" | "rejected";
const STATUS_TABS: { label: string; value: StatusTab }[] = [
  { label: "Pending",  value: "pending" },
  { label: "Active",   value: "active" },
  { label: "Rejected", value: "rejected" },
];

// Map UI status-tab → DB statuses to query
const STATUS_QUERY: Record<StatusTab, string[]> = {
  pending:  ["pending"],
  // "approved" = admin-approved but cron hasn't flipped it to "active" yet.
  // Show both so admins don't lose sight of in-flight rows.
  active:   ["approved", "active"],
  rejected: ["rejected"],
};

type TypeFilter = "all" | "sponsored" | "banner";
const TYPE_FILTERS: { label: string; value: TypeFilter }[] = [
  { label: "All",       value: "all" },
  { label: "Sponsored", value: "sponsored" },
  { label: "Banner",    value: "banner" },
];

// ── Normalized feed item ─────────────────────────────────────────────────────

type FeedItem =
  | {
      kind: "sponsored";
      id: string;
      requestedAt: string;
      status: string;
      providerName: string;
      classTitle: string;
      coverImageUrl: string | null;
      categoryName: string | null;
      validFrom: string | null;
      validUntil: string | null;
      impressionCount: number;
      clickCount: number;
      offAppPaymentRef: string | null;
      rejectionReason: string | null;
    }
  | {
      kind: "banner";
      surface: "explore_banner";
      id: string;
      requestedAt: string;
      status: string;
      moderationStatus: string;
      providerName: string;
      classTitle: string | null;
      imageUrl: string;
      centerAddress: string | null;
      radiusKm: number | null;
      validFrom: string | null;
      validUntil: string | null;
      impressionCount: number;
      clickCount: number;
      offAppPaymentRef: string | null;
      rejectionReason: string | null;
    };

// ── Page ─────────────────────────────────────────────────────────────────────

const PlatformSponsored = () => {
  const { profile } = useUser();
  const [tab, setTab] = useState<StatusTab>("pending");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const dbStatuses = STATUS_QUERY[tab];
  const { data: sponsoredData, isLoading: lSponsored, refetch: refetchSponsored } =
    usePlatformSponsoredRequests(dbStatuses);
  const { data: bannerData, isLoading: lBanner, refetch: refetchBanner } =
    usePlatformBannerRequests(dbStatuses);

  const refresh = useRefreshSponsoredSlots();

  /** Called after a successful admin action.  Triggers the lifecycle cron so
   *  approved rows flip to active immediately, then refetches both queues. */
  const refreshAndRefetch = async (opts?: { silent?: boolean }) => {
    try {
      const result = await refresh.mutateAsync();
      if (!opts?.silent) toast.success(formatRefreshSummary(result));
    } catch (e) {
      if (!opts?.silent) toast.error(`Refresh failed: ${(e as Error).message}`);
      else console.warn("refresh-sponsored-slots invoke failed:", e);
    }
    refetchSponsored();
    refetchBanner();
  };

  const isLoading = lSponsored || lBanner;

  const feed = useMemo<FeedItem[]>(() => {
    const sponsoredItems: FeedItem[] = ((sponsoredData ?? []) as unknown as SponsoredRowRaw[]).map((s) => ({
      kind: "sponsored",
      id: s.id,
      requestedAt: s.requested_at,
      status: s.status,
      providerName: s.service_providers?.business_name ?? "—",
      classTitle: s.classes?.title ?? "—",
      coverImageUrl: s.classes?.cover_image_url ?? null,
      categoryName: s.classes?.class_categories?.name ?? null,
      validFrom: s.valid_from,
      validUntil: s.valid_until,
      impressionCount: s.impression_count ?? 0,
      clickCount: s.click_count ?? 0,
      offAppPaymentRef: s.off_app_payment_ref,
      rejectionReason: s.rejection_reason,
    }));

    const bannerItems: FeedItem[] = ((bannerData ?? []) as unknown as BannerRowRaw[]).map((b) => ({
      kind: "banner",
      surface: b.surface,
      id: b.id,
      requestedAt: b.requested_at,
      status: b.status,
      moderationStatus: b.moderation_status,
      providerName: b.service_providers?.business_name ?? "—",
      classTitle: b.classes?.title ?? null,
      imageUrl: b.image_url,
      centerAddress: b.center_address,
      radiusKm: b.radius_km,
      validFrom: b.valid_from,
      validUntil: b.valid_until,
      impressionCount: b.impression_count ?? 0,
      clickCount: b.click_count ?? 0,
      offAppPaymentRef: b.off_app_payment_ref,
      rejectionReason: b.rejection_reason,
    }));

    const merged = [...sponsoredItems, ...bannerItems].sort((a, b) =>
      a.requestedAt < b.requestedAt ? 1 : -1
    );

    if (typeFilter === "all") return merged;
    return merged.filter((item) => {
      if (typeFilter === "sponsored") return item.kind === "sponsored";
      if (typeFilter === "banner") return item.kind === "banner";
      return true;
    });
  }, [sponsoredData, bannerData, typeFilter]);

  const counts = useMemo(() => {
    const sponsored = (sponsoredData ?? []).length;
    const banner = (bannerData ?? []).length;
    return { all: sponsored + banner, sponsored, banner };
  }, [sponsoredData, bannerData]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Sponsored & Featured</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Approve top-of-Explore slots and banners.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refreshAndRefetch()}
          disabled={refresh.isPending}
          className="gap-1.5"
          title="Run the lifecycle cron now — flips approved rows to active and expires past-window rows. Also runs every 15 min automatically."
        >
          {refresh.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Refresh
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? counts.all
              : f.value === "sponsored"
                ? counts.sponsored
                : counts.banner;
          return (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === f.value
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  typeFilter === f.value ? "bg-indigo-100" : "bg-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feed */}
      {isLoading ? (
        <SkeletonList />
      ) : !feed.length ? (
        <EmptyRow
          label={`No ${tab === "active" ? "active" : tab} ${
            typeFilter === "all" ? "items" : TYPE_FILTERS.find((f) => f.value === typeFilter)?.label.toLowerCase()
          }`}
        />
      ) : (
        <div className="space-y-3">
          {feed.map((item) =>
            item.kind === "sponsored" ? (
              <SponsoredCard
                key={`s-${item.id}`}
                item={item}
                showActions={tab === "pending"}
                profileId={profile?.id}
                onAfterAction={() => refreshAndRefetch({ silent: true })}
              />
            ) : (
              <BannerCard
                key={`b-${item.id}`}
                item={item}
                showActions={tab === "pending"}
                profileId={profile?.id}
                onAfterAction={() => refreshAndRefetch({ silent: true })}
              />
            )
          )}
        </div>
      )}
    </div>
  );
};

export default PlatformSponsored;

// ── Sponsored card ───────────────────────────────────────────────────────────

const SponsoredCard = ({
  item,
  showActions,
  profileId,
  onAfterAction,
}: {
  item: Extract<FeedItem, { kind: "sponsored" }>;
  showActions: boolean;
  profileId: string | undefined;
  onAfterAction: () => void;
}) => {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const approve = useApproveSponsored();
  const reject = useRejectSponsored();

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        {item.coverImageUrl ? (
          <img src={item.coverImageUrl} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="h-14 w-20 shrink-0 rounded-lg bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-amber-100 text-[10px] text-amber-700">Sponsored</Badge>
            <p className="line-clamp-1 text-sm font-semibold">{item.classTitle}</p>
          </div>
          <p className="text-xs text-muted-foreground">{item.providerName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            {item.categoryName && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                {item.categoryName}
              </Badge>
            )}
            <StatusPill status={item.status} />
          </div>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {new Date(item.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </span>
      </div>

      {item.offAppPaymentRef && (
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-[10px] text-muted-foreground">Payment Reference</p>
          <p className="font-mono text-xs font-semibold">{item.offAppPaymentRef}</p>
        </div>
      )}

      {item.validFrom && item.validUntil && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Window:</span>{" "}
          {new Date(item.validFrom).toLocaleDateString("en-IN")} →{" "}
          {new Date(item.validUntil).toLocaleDateString("en-IN")}
        </p>
      )}

      {(item.status === "active" || item.status === "approved") && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Target size={11} /> {item.impressionCount} views
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp size={11} /> {item.clickCount} clicks
          </span>
        </div>
      )}

      {item.rejectionReason && (
        <p className="text-xs italic text-red-600">{item.rejectionReason}</p>
      )}

      {showActions && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={() => setApproveOpen(true)}
          >
            <Megaphone size={14} /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => setRejectOpen(true)}
          >
            <XCircle size={14} /> Reject
          </Button>
        </div>
      )}

      <ApproveSheet
        kind="sponsored"
        open={approveOpen}
        onOpenChange={setApproveOpen}
        initialPaymentRef={item.offAppPaymentRef ?? ""}
        busy={approve.isPending}
        onConfirm={async ({ validFrom, validUntil, paymentRef }) => {
          if (!profileId) return;
          await approve.mutateAsync({
            listingId: item.id,
            reviewedBy: profileId,
            validFrom,
            validUntil,
            offAppPaymentRef: paymentRef || undefined,
          });
          toast.success("Approved. Will go live at start date.");
          setApproveOpen(false);
          onAfterAction();
        }}
      />

      <RejectSheet
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        busy={reject.isPending}
        onConfirm={async (reason) => {
          if (!profileId) return;
          await reject.mutateAsync({
            listingId: item.id,
            reviewedBy: profileId,
            rejectionReason: reason || undefined,
          });
          toast.success("Rejected");
          setRejectOpen(false);
          onAfterAction();
        }}
      />
    </Card>
  );
};

// ── Banner card ──────────────────────────────────────────────────────────────

const BannerCard = ({
  item,
  showActions,
  profileId,
  onAfterAction,
}: {
  item: Extract<FeedItem, { kind: "banner" }>;
  showActions: boolean;
  profileId: string | undefined;
  onAfterAction: () => void;
}) => {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const approve = useApproveFeaturedBanner();
  const reject = useRejectFeaturedBanner();

  return (
    <Card className="overflow-hidden p-0">
      <img src={item.imageUrl} alt="" className="h-28 w-full object-cover" />
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-indigo-100 text-[10px] text-indigo-700">
                Banner
              </Badge>
              <p className="text-sm font-semibold">{item.providerName}</p>
              <StatusPill status={item.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.centerAddress ?? "—"} · {item.radiusKm} km
            </p>
            {item.classTitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">→ {item.classTitle}</p>
            )}
            {item.moderationStatus === "rejected" && (
              <Badge className="mt-1 bg-red-100 text-[10px] text-red-700">Image flagged</Badge>
            )}
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {new Date(item.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        </div>

        {item.offAppPaymentRef && (
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Payment Reference</p>
            <p className="font-mono text-xs font-semibold">{item.offAppPaymentRef}</p>
          </div>
        )}

        {item.validFrom && item.validUntil && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Window:</span>{" "}
            {new Date(item.validFrom).toLocaleDateString("en-IN")} →{" "}
            {new Date(item.validUntil).toLocaleDateString("en-IN")}
          </p>
        )}

        {(item.status === "active" || item.status === "approved") && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Target size={11} /> {item.impressionCount} views
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp size={11} /> {item.clickCount} clicks
            </span>
          </div>
        )}

        {item.rejectionReason && (
          <p className="text-xs italic text-red-600">{item.rejectionReason}</p>
        )}

        {showActions && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => setApproveOpen(true)}
            >
              <Sparkles size={14} /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setRejectOpen(true)}
            >
              <XCircle size={14} /> Reject
            </Button>
          </div>
        )}
      </div>

      <ApproveSheet
        kind="banner"
        open={approveOpen}
        onOpenChange={setApproveOpen}
        initialPaymentRef={item.offAppPaymentRef ?? ""}
        busy={approve.isPending}
        onConfirm={async ({ validFrom, validUntil, paymentRef }) => {
          if (!profileId) return;
          await approve.mutateAsync({
            bannerId: item.id,
            reviewedBy: profileId,
            validFrom,
            validUntil,
            offAppPaymentRef: paymentRef || undefined,
          });
          toast.success("Banner approved");
          setApproveOpen(false);
          onAfterAction();
        }}
      />

      <RejectSheet
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        busy={reject.isPending}
        onConfirm={async (reason) => {
          if (!profileId) return;
          await reject.mutateAsync({
            bannerId: item.id,
            reviewedBy: profileId,
            rejectionReason: reason || undefined,
          });
          toast.success("Rejected");
          setRejectOpen(false);
          onAfterAction();
        }}
      />
    </Card>
  );
};

// ── Approve / Reject sheets ──────────────────────────────────────────────────

const ApproveSheet = ({
  kind,
  open,
  onOpenChange,
  busy,
  initialPaymentRef,
  onConfirm,
}: {
  kind: "sponsored" | "banner";
  open: boolean;
  onOpenChange: (v: boolean) => void;
  busy: boolean;
  initialPaymentRef: string;
  onConfirm: (v: { validFrom: string; validUntil: string; paymentRef: string }) => void | Promise<void>;
}) => {
  const today = new Date().toISOString().split("T")[0];
  const [validFrom, setValidFrom] = useState(today);
  const [validUntil, setValidUntil] = useState("");
  const [paymentRef, setPaymentRef] = useState(initialPaymentRef);

  // Reset on open
  const onChange = (v: boolean) => {
    if (v) {
      setValidFrom(today);
      setValidUntil("");
      setPaymentRef(initialPaymentRef);
    }
    onOpenChange(v);
  };

  const handle = () => {
    if (!validFrom || !validUntil) return;
    onConfirm({
      validFrom: new Date(validFrom).toISOString(),
      validUntil: new Date(validUntil).toISOString(),
      paymentRef,
    });
  };

  const Icon = kind === "sponsored" ? Megaphone : Sparkles;

  return (
    <Sheet open={open} onOpenChange={onChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-5">
          <SheetTitle className="flex items-center gap-2">
            <Icon size={18} className="text-indigo-600" />
            Approve {kind === "sponsored" ? "Sponsored Listing" : "Banner"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          {kind === "sponsored" && (
            <p className="text-xs text-muted-foreground">
              Slot position is computed at query time — closest to seeker wins #1.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valid From <span className="text-destructive">*</span></Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} min={today} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Valid Until <span className="text-destructive">*</span></Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} min={validFrom || today} className="h-11" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment Reference (optional)</Label>
            <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="UPI txn id or bank ref" className="h-11" />
          </div>
          <Button
            className="h-11 w-full gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={handle}
            disabled={!validFrom || !validUntil || busy}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
            Confirm Approval
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const RejectSheet = ({
  open,
  onOpenChange,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  busy: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}) => {
  const [reason, setReason] = useState("");
  const onChange = (v: boolean) => {
    if (v) setReason("");
    onOpenChange(v);
  };
  return (
    <Sheet open={open} onOpenChange={onChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-5">
          <SheetTitle>Reject</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason <span className="font-normal text-muted-foreground">(optional, shown to provider)</span></Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection…" rows={3} className="resize-none" />
          </div>
          <Button
            className="h-11 w-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onConfirm(reason)}
            disabled={busy}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            Confirm Rejection
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ── Shared bits + types ──────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  approved:  "bg-blue-100 text-blue-700",
  active:    "bg-green-100 text-green-700",
  expired:   "bg-slate-100 text-slate-600",
  rejected:  "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-600",
};

const StatusPill = ({ status }: { status: string }) => (
  <Badge className={`${STATUS_PILL[status] ?? "bg-muted"} border-0 text-[10px]`}>
    {status}
  </Badge>
);

const SkeletonList = () => (
  <div className="space-y-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-32 rounded-xl" />
    ))}
  </div>
);

const EmptyRow = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center gap-3 py-16">
    <Megaphone size={44} className="text-muted-foreground/40" />
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);

function formatRefreshSummary(r: RefreshSponsoredResult): string {
  const parts: string[] = [];
  if (r.sponsored_activated) parts.push(`${r.sponsored_activated} sponsored activated`);
  if (r.banners_activated)   parts.push(`${r.banners_activated} banner${r.banners_activated === 1 ? "" : "s"} activated`);
  if (r.sponsored_expired)   parts.push(`${r.sponsored_expired} sponsored expired`);
  if (r.banners_expired)     parts.push(`${r.banners_expired} banner${r.banners_expired === 1 ? "" : "s"} expired`);
  return parts.length ? `Refreshed: ${parts.join(" · ")}` : "Refreshed — no state changes";
}

// Raw row shapes from the hooks (relations come as nested objects).

type SponsoredRowRaw = {
  id: string;
  status: string;
  valid_from: string | null;
  valid_until: string | null;
  impression_count: number | null;
  click_count: number | null;
  off_app_payment_ref: string | null;
  rejection_reason: string | null;
  requested_at: string;
  classes: {
    title: string;
    cover_image_url: string | null;
    class_categories: { name: string } | null;
  } | null;
  service_providers: { business_name: string } | null;
};

type BannerRowRaw = {
  id: string;
  status: string;
  moderation_status: string;
  surface: "explore_banner";
  image_url: string;
  center_address: string | null;
  radius_km: number | null;
  valid_from: string | null;
  valid_until: string | null;
  impression_count: number | null;
  click_count: number | null;
  off_app_payment_ref: string | null;
  rejection_reason: string | null;
  requested_at: string;
  classes: { title: string } | null;
  service_providers: { business_name: string } | null;
};
