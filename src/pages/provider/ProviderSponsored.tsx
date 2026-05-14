/**
 * /provider/sponsored — Phase 8 provider monetization surface.
 *
 * Two tabs:
 *   1. Sponsored Listings — class appears top-of-Explore in a region.
 *   2. Featured Banners   — image banner on Landing (home) or Explore (carousel).
 *
 * Premium-only.  Basic providers see an upgrade upsell instead of forms.
 * Pricing is "Contact admin for pricing" per Phase 8 design — no fixed price
 * displayed.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useProviderClasses } from "@/hooks/useClasses";
import {
  useMySponsoredRequests,
  useMyFeaturedBanners,
  useRequestSponsored,
  useRequestFeaturedBanner,
  useUploadFeaturedBannerImage,
  useCancelSponsored,
  useCancelFeaturedBanner,
} from "@/hooks/useSponsored";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import MapplsPicker from "@/components/location/MapplsPicker";
import UpgradeRequestSheet from "@/components/subscription/UpgradeRequestSheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  Clock,
  Crown,
  ImagePlus,
  Megaphone,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

// ── Status meta ──────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pending review", cls: "bg-amber-100 text-amber-700" },
  approved:  { label: "Approved",        cls: "bg-blue-100 text-blue-700" },
  active:    { label: "Active",          cls: "bg-green-100 text-green-700" },
  expired:   { label: "Expired",         cls: "bg-slate-100 text-slate-600" },
  rejected:  { label: "Rejected",        cls: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled",       cls: "bg-slate-100 text-slate-600" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function ctr(impressions: number, clicks: number) {
  if (!impressions) return "—";
  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

const ProviderSponsored = () => {
  const { providerProfile, isPremium } = useUser();
  const providerId = providerProfile?.id;
  const [params] = useSearchParams();
  const prefillClassId = params.get("classId") ?? undefined;

  if (!isPremium) {
    return <PremiumUpsell />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
        <div className="mb-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Crown className="text-amber-500" size={22} />
            Sponsored & Featured
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Boost class visibility with sponsored slots and banner placements.
          </p>
        </div>

        <Tabs defaultValue="sponsored">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="sponsored">
              <Megaphone size={14} className="mr-1.5" />
              Sponsored
            </TabsTrigger>
            <TabsTrigger value="banners">
              <Sparkles size={14} className="mr-1.5" />
              Banners
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sponsored">
            <SponsoredTab providerId={providerId!} prefillClassId={prefillClassId} />
          </TabsContent>
          <TabsContent value="banners">
            <BannersTab providerId={providerId!} />
          </TabsContent>
        </Tabs>
      </main>
      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderSponsored;

// ────────────────────────────────────────────────────────────────────────────
// Premium upsell (Basic tier landing)
// ────────────────────────────────────────────────────────────────────────────

const PremiumUpsell = () => {
  const [showUpgrade, setShowUpgrade] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-lg px-4 pt-6">
        <Card className="overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
          <Crown size={32} className="text-amber-500" />
          <h2 className="mt-3 text-xl font-bold">Sponsored & Featured are Premium</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upgrade to Premium to request top-3 Explore placements and home / explore banners.
          </p>
          <Button
            className="mt-5 w-full bg-amber-500 hover:bg-amber-600"
            onClick={() => setShowUpgrade(true)}
          >
            Upgrade to Premium
          </Button>
        </Card>
      </main>
      <UpgradeRequestSheet open={showUpgrade} onOpenChange={setShowUpgrade} />
      <BottomNav persona="provider" />
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Sponsored tab
// ────────────────────────────────────────────────────────────────────────────

const SponsoredTab = ({
  providerId,
  prefillClassId,
}: {
  providerId: string;
  prefillClassId?: string;
}) => {
  const [open, setOpen] = useState(false);
  const { data: rows, isLoading } = useMySponsoredRequests(providerId);
  const cancel = useCancelSponsored();

  // Auto-open the request sheet when arriving from "Promote this class"
  useEffect(() => {
    if (prefillClassId) setOpen(true);
  }, [prefillClassId]);

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Contact admin for pricing.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={14} className="mr-1" />
          Request slot
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !rows?.length ? (
        <EmptyState
          icon={Megaphone}
          title="No sponsored slots yet"
          body="Request a slot to feature one of your classes at the top of Explore in a region."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const meta = STATUS_META[r.status] ?? STATUS_META.pending;
            return (
              <li key={r.id}>
                <Card className="p-3">
                  <div className="flex items-start gap-3">
                    {r.classes?.cover_image_url ? (
                      <img
                        src={r.classes.cover_image_url}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-lg bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{r.classes?.title ?? "Class"}</p>
                        <Badge className={meta.cls + " text-xs"}>{meta.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.center_address ?? "—"} · {r.radius_km} km
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmtDate(r.valid_from)} → {fmtDate(r.valid_until)}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Target size={12} /> {r.impression_count} views
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <TrendingUp size={12} /> {r.click_count} clicks · CTR {ctr(r.impression_count, r.click_count)}
                        </span>
                      </div>
                      {r.rejection_reason && (
                        <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                          {r.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  {(r.status === "pending" || r.status === "active") && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Cancel this sponsored slot request?")) {
                            cancel.mutate(r.id, {
                              onSuccess: () => toast.success("Cancelled"),
                            });
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <SponsoredRequestSheet
          providerId={providerId}
          prefillClassId={prefillClassId}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Banners tab
// ────────────────────────────────────────────────────────────────────────────

const BannersTab = ({ providerId }: { providerId: string }) => {
  const [open, setOpen] = useState(false);
  const { data: rows, isLoading } = useMyFeaturedBanners(providerId);
  const cancel = useCancelFeaturedBanner();

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Contact admin for pricing.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={14} className="mr-1" />
          Request banner
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !rows?.length ? (
        <EmptyState
          icon={Sparkles}
          title="No banners yet"
          body="Request a banner placement on the home page (single rotating) or in Explore (carousel)."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const meta = STATUS_META[r.status] ?? STATUS_META.pending;
            return (
              <li key={r.id}>
                <Card className="overflow-hidden p-0">
                  <img src={r.image_url} alt="" className="h-28 w-full object-cover" />
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <Badge className={meta.cls + " text-xs"}>{meta.label}</Badge>
                      {r.moderation_status === "rejected" && (
                        <Badge className="bg-red-100 text-xs text-red-700">Image flagged</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.center_address ?? "—"} · {r.radius_km} km
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {fmtDate(r.valid_from)} → {fmtDate(r.valid_until)}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Target size={12} /> {r.impression_count} views
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp size={12} /> {r.click_count} clicks · CTR {ctr(r.impression_count, r.click_count)}
                      </span>
                    </div>
                    {r.rejection_reason && (
                      <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                        {r.rejection_reason}
                      </p>
                    )}
                    {(r.status === "pending" || r.status === "active") && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Cancel this banner request?")) {
                              cancel.mutate(r.id, {
                                onSuccess: () => toast.success("Cancelled"),
                              });
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <BannerRequestSheet
          providerId={providerId}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Request sheets
// ────────────────────────────────────────────────────────────────────────────

const SponsoredRequestSheet = ({
  providerId,
  prefillClassId,
  open,
  onOpenChange,
}: {
  providerId: string;
  prefillClassId?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const { data: classes } = useProviderClasses(providerId, "published");
  const request = useRequestSponsored();

  const [classId, setClassId] = useState<string>(prefillClassId ?? "");
  const [region, setRegion] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<string>("10");
  const [validFrom, setValidFrom] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [paymentRef, setPaymentRef] = useState<string>("");

  const selectedClass = useMemo(
    () => (classes as unknown as { id: string; category_id: string | null; title: string }[] | undefined)?.find((c) => c.id === classId),
    [classes, classId]
  );

  const canSubmit =
    classId && region && Number(radiusKm) > 0 && validFrom && validUntil && validFrom < validUntil;

  const submit = () => {
    if (!canSubmit || !region) return;
    request.mutate(
      {
        providerId,
        classId,
        categoryId: selectedClass?.category_id ?? null,
        centerAddress: region.address,
        centerLat: region.lat,
        centerLng: region.lng,
        radiusKm: Number(radiusKm),
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        offAppPaymentRef: paymentRef || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Sponsored slot requested. Admin will review shortly.");
          onOpenChange(false);
        },
        onError: (e: unknown) => toast.error((e as Error).message ?? "Failed"),
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Request a sponsored slot</SheetTitle>
          <SheetDescription>
            Pick a class, the region, and dates. Pricing is handled off-app — contact admin for pricing.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 pb-6">
          <div>
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a published class" />
              </SelectTrigger>
              <SelectContent>
                {(classes as unknown as { id: string; title: string }[] | undefined)?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Region center</Label>
            <MapplsPicker value={region} onChange={setRegion} />
          </div>

          <div>
            <Label htmlFor="radius">Radius (km)</Label>
            <Input
              id="radius"
              type="number"
              min={1}
              max={50}
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="from">Valid from</Label>
              <Input id="from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="until">Valid until</Label>
              <Input id="until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="ref">Payment reference (optional)</Label>
            <Input
              id="ref"
              placeholder="UPI txn id or bank ref"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />
          </div>

          <Button className="w-full" disabled={!canSubmit || request.isPending} onClick={submit}>
            {request.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const BannerRequestSheet = ({
  providerId,
  open,
  onOpenChange,
}: {
  providerId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const upload = useUploadFeaturedBannerImage();
  const request = useRequestFeaturedBanner();
  const { data: classes } = useProviderClasses(providerId, "published");

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [region, setRegion] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<string>("10");
  const [validFrom, setValidFrom] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [paymentRef, setPaymentRef] = useState<string>("");

  const onPickFile = (f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  // Banners are explore-only post-migration 033; region + radius always required.
  const canSubmit =
    file && validFrom && validUntil && validFrom < validUntil && region && Number(radiusKm) > 0;

  const submit = async () => {
    if (!canSubmit || !file || !region) return;
    try {
      const imageUrl = await upload.mutateAsync({ providerId, file });
      await request.mutateAsync({
        providerId,
        surface: "explore_banner",
        imageUrl,
        targetUrl: targetUrl || undefined,
        classId: classId || null,
        centerAddress: region.address,
        centerLat: region.lat,
        centerLng: region.lng,
        radiusKm: Number(radiusKm),
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        offAppPaymentRef: paymentRef || undefined,
      });
      toast.success("Banner submitted for review.");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message ?? "Failed");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Request a featured banner</SheetTitle>
          <SheetDescription>
            Image goes through moderation before going live. Contact admin for pricing.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 pb-6">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Banners appear in the carousel above the /explore page for seekers
            in your selected region. Up to 5 banners are shown, ordered by
            proximity to the seeker.
          </p>

          <div>
            <Label>Banner image</Label>
            <div className="mt-1 rounded-lg border-2 border-dashed border-muted bg-muted/30 p-4">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-32 w-full rounded object-cover" />
              ) : (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <ImagePlus size={32} />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="mt-3 w-full text-xs"
                onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="target">Tap-through URL (optional)</Label>
            <Input
              id="target"
              placeholder="https://… or /class/:id"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave blank to link to a chosen class.
            </p>
          </div>

          <div>
            <Label>Linked class (optional)</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a class" />
              </SelectTrigger>
              <SelectContent>
                {(classes as unknown as { id: string; title: string }[] | undefined)?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Region center</Label>
            <MapplsPicker value={region} onChange={setRegion} />
          </div>
          <div>
            <Label htmlFor="b-radius">Radius (km)</Label>
            <Input
              id="b-radius"
              type="number"
              min={1}
              max={50}
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bfrom">Valid from</Label>
              <Input id="bfrom" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="buntil">Valid until</Label>
              <Input id="buntil" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="bref">Payment reference (optional)</Label>
            <Input
              id="bref"
              placeholder="UPI txn id or bank ref"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            disabled={!canSubmit || upload.isPending || request.isPending}
            onClick={submit}
          >
            {upload.isPending || request.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Empty state
// ────────────────────────────────────────────────────────────────────────────

const EmptyState = ({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Megaphone;
  title: string;
  body: string;
}) => (
  <Card className="p-8 text-center">
    <Icon size={28} className="mx-auto text-muted-foreground" />
    <p className="mt-3 text-sm font-semibold">{title}</p>
    <p className="mt-1 text-xs text-muted-foreground">{body}</p>
  </Card>
);
