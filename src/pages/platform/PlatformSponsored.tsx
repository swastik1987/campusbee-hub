/**
 * /platform/sponsored — Phase 8 platform admin surface.
 *
 * Two top-level tabs (Surface):
 *   - Sponsored Listings — class top-of-Explore slot requests.
 *   - Featured Banners   — image banner requests for home or explore surfaces.
 *
 * Each surface has Pending / Active / Rejected sub-tabs.
 *
 * `slot_position` is no longer collected at approval time — it's computed at
 * query time by sponsored_for_location (nearest-to-seeker wins).
 */

import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  usePlatformSponsoredRequests,
  useApproveSponsored,
  useRejectSponsored,
  usePlatformBannerRequests,
  useApproveFeaturedBanner,
  useRejectFeaturedBanner,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, MapPin, Megaphone, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";

type SubTab = "pending" | "approved" | "rejected";
const SUB_TABS: { label: string; value: SubTab }[] = [
  { label: "Pending", value: "pending" },
  { label: "Active", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const PlatformSponsored = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Sponsored & Featured</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Approve top-of-Explore slots and home / explore banners.
        </p>
      </div>

      <Tabs defaultValue="sponsored">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="sponsored">
            <Megaphone size={14} className="mr-1.5" /> Sponsored
          </TabsTrigger>
          <TabsTrigger value="banners">
            <Sparkles size={14} className="mr-1.5" /> Banners
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sponsored" className="mt-5">
          <SponsoredSection />
        </TabsContent>
        <TabsContent value="banners" className="mt-5">
          <BannersSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlatformSponsored;

// ────────────────────────────────────────────────────────────────────────────
// Sponsored Listings section
// ────────────────────────────────────────────────────────────────────────────

const SponsoredSection = () => {
  const { profile } = useUser();
  const [tab, setTab] = useState<SubTab>("pending");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const { data: listings, isLoading, error, refetch } = usePlatformSponsoredRequests(tab);
  const approve = useApproveSponsored();
  const reject = useRejectSponsored();
  const today = new Date().toISOString().split("T")[0];

  const handleApprove = async () => {
    if (!approveId || !profile || !validFrom || !validUntil) return;
    try {
      await approve.mutateAsync({
        listingId: approveId,
        reviewedBy: profile.id,
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        offAppPaymentRef: paymentRef || undefined,
      });
      toast.success("Approved. Will go live at start date.");
      setApproveId(null);
      setPaymentRef("");
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!rejectId || !profile) return;
    try {
      await reject.mutateAsync({
        listingId: rejectId,
        reviewedBy: profile.id,
        rejectionReason: rejectReason || undefined,
      });
      toast.success("Rejected");
      setRejectId(null);
      setRejectReason("");
    } catch {
      toast.error("Failed to reject");
    }
  };

  return (
    <div className="space-y-4">
      <SubTabRow tab={tab} onChange={setTab} />

      {isLoading ? (
        <SkeletonList />
      ) : error ? (
        <ErrorRow onRetry={() => refetch()} />
      ) : !(listings as unknown[])?.length ? (
        <EmptyRow icon={Megaphone} label={`No ${tab === "approved" ? "active" : tab} sponsored requests`} />
      ) : (
        <div className="space-y-3">
          {(listings as unknown as SponsoredRow[]).map((l) => (
            <Card key={l.id} className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                {l.classes?.cover_image_url ? (
                  <img src={l.classes.cover_image_url} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-14 w-20 shrink-0 rounded-lg bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold">{l.classes?.title}</p>
                  <p className="text-xs text-muted-foreground">{l.service_providers?.business_name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin size={10} /> {l.radius_km} km
                    </span>
                    {l.classes?.class_categories?.name && (
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                        {l.classes.class_categories.name}
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(l.requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>

              {l.off_app_payment_ref && (
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Payment Reference</p>
                  <p className="font-mono text-xs font-semibold">{l.off_app_payment_ref}</p>
                </div>
              )}

              {l.valid_from && l.valid_until && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Active:</span>{" "}
                  {new Date(l.valid_from).toLocaleDateString("en-IN")} →{" "}
                  {new Date(l.valid_until).toLocaleDateString("en-IN")}
                </p>
              )}

              {l.rejection_reason && (
                <p className="text-xs italic text-red-600">{l.rejection_reason}</p>
              )}

              {tab === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
                    onClick={() => {
                      setApproveId(l.id);
                      setValidFrom(today);
                      setValidUntil("");
                      setPaymentRef(l.off_app_payment_ref ?? "");
                    }}
                  >
                    <Megaphone size={14} /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setRejectId(l.id);
                      setRejectReason("");
                    }}
                  >
                    <XCircle size={14} /> Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Approve sheet */}
      <Sheet open={!!approveId} onOpenChange={(o) => !o && setApproveId(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2">
              <Megaphone size={18} className="text-indigo-600" /> Approve Sponsored Listing
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Slot position is computed at query time — closest to seeker wins #1.
            </p>
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
            <Button className="h-11 w-full gap-2 bg-indigo-600 text-white hover:bg-indigo-700" onClick={handleApprove} disabled={!validFrom || !validUntil || approve.isPending}>
              {approve.isPending ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
              Confirm Approval
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reject sheet */}
      <Sheet open={!!rejectId} onOpenChange={(o) => { if (!o) { setRejectId(null); setRejectReason(""); } }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle>Reject Listing</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection…" rows={3} className="resize-none" />
            </div>
            <Button className="h-11 w-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleReject} disabled={reject.isPending}>
              {reject.isPending && <Loader2 size={16} className="animate-spin" />}
              Confirm Rejection
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Featured Banners section
// ────────────────────────────────────────────────────────────────────────────

const BannersSection = () => {
  const { profile } = useUser();
  const [tab, setTab] = useState<SubTab>("pending");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const { data: banners, isLoading, error, refetch } = usePlatformBannerRequests(tab);
  const approve = useApproveFeaturedBanner();
  const reject = useRejectFeaturedBanner();
  const today = new Date().toISOString().split("T")[0];

  const handleApprove = async () => {
    if (!approveId || !profile || !validFrom || !validUntil) return;
    try {
      await approve.mutateAsync({
        bannerId: approveId,
        reviewedBy: profile.id,
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        offAppPaymentRef: paymentRef || undefined,
      });
      toast.success("Banner approved");
      setApproveId(null);
      setPaymentRef("");
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!rejectId || !profile) return;
    try {
      await reject.mutateAsync({
        bannerId: rejectId,
        reviewedBy: profile.id,
        rejectionReason: rejectReason || undefined,
      });
      toast.success("Rejected");
      setRejectId(null);
      setRejectReason("");
    } catch {
      toast.error("Failed to reject");
    }
  };

  return (
    <div className="space-y-4">
      <SubTabRow tab={tab} onChange={setTab} />

      {isLoading ? (
        <SkeletonList />
      ) : error ? (
        <ErrorRow onRetry={() => refetch()} />
      ) : !(banners as unknown[])?.length ? (
        <EmptyRow icon={Sparkles} label={`No ${tab === "approved" ? "active" : tab} banner requests`} />
      ) : (
        <div className="space-y-3">
          {(banners as unknown as BannerRow[]).map((b) => (
            <Card key={b.id} className="overflow-hidden p-0">
              <img src={b.image_url} alt="" className="h-28 w-full object-cover" />
              <div className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {b.surface === "home_banner" ? "Home" : "Explore"}
                      </Badge>
                      <p className="text-sm font-semibold">{b.service_providers?.business_name}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {b.surface === "explore_banner"
                        ? `${b.center_address ?? "—"} · ${b.radius_km} km`
                        : "Global"}
                    </p>
                    {b.classes?.title && (
                      <p className="mt-0.5 text-xs text-muted-foreground">→ {b.classes.title}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(b.requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>

                {b.off_app_payment_ref && (
                  <div className="rounded-lg bg-muted/60 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">Payment Reference</p>
                    <p className="font-mono text-xs font-semibold">{b.off_app_payment_ref}</p>
                  </div>
                )}

                {b.valid_from && b.valid_until && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Active:</span>{" "}
                    {new Date(b.valid_from).toLocaleDateString("en-IN")} →{" "}
                    {new Date(b.valid_until).toLocaleDateString("en-IN")}
                  </p>
                )}

                {b.rejection_reason && (
                  <p className="text-xs italic text-red-600">{b.rejection_reason}</p>
                )}

                {tab === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
                      onClick={() => {
                        setApproveId(b.id);
                        setValidFrom(today);
                        setValidUntil("");
                        setPaymentRef(b.off_app_payment_ref ?? "");
                      }}
                    >
                      <Sparkles size={14} /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setRejectId(b.id);
                        setRejectReason("");
                      }}
                    >
                      <XCircle size={14} /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!approveId} onOpenChange={(o) => !o && setApproveId(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-600" /> Approve Banner
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
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
            <Button className="h-11 w-full gap-2 bg-indigo-600 text-white hover:bg-indigo-700" onClick={handleApprove} disabled={!validFrom || !validUntil || approve.isPending}>
              {approve.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Confirm Approval
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!rejectId} onOpenChange={(o) => { if (!o) { setRejectId(null); setRejectReason(""); } }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle>Reject Banner</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection…" rows={3} className="resize-none" />
            </div>
            <Button className="h-11 w-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleReject} disabled={reject.isPending}>
              {reject.isPending && <Loader2 size={16} className="animate-spin" />}
              Confirm Rejection
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Shared UI bits + types
// ────────────────────────────────────────────────────────────────────────────

type SponsoredRow = {
  id: string;
  status: string;
  radius_km: number;
  valid_from: string | null;
  valid_until: string | null;
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

type BannerRow = {
  id: string;
  status: string;
  surface: "home_banner" | "explore_banner";
  image_url: string;
  center_address: string | null;
  radius_km: number | null;
  valid_from: string | null;
  valid_until: string | null;
  off_app_payment_ref: string | null;
  rejection_reason: string | null;
  requested_at: string;
  classes: { title: string } | null;
  service_providers: { business_name: string } | null;
};

const SubTabRow = ({ tab, onChange }: { tab: SubTab; onChange: (v: SubTab) => void }) => (
  <div className="flex flex-wrap gap-2">
    {SUB_TABS.map((t) => (
      <button
        key={t.value}
        onClick={() => onChange(t.value)}
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
);

const SkeletonList = () => (
  <div className="space-y-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-32 rounded-xl" />
    ))}
  </div>
);

const ErrorRow = ({ onRetry }: { onRetry: () => void }) => (
  <div className="py-12 text-center">
    <p className="text-sm text-muted-foreground">Failed to load</p>
    <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
      Retry
    </Button>
  </div>
);

const EmptyRow = ({ icon: Icon, label }: { icon: typeof Megaphone; label: string }) => (
  <div className="flex flex-col items-center gap-3 py-16">
    <Icon size={44} className="text-muted-foreground/40" />
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);
