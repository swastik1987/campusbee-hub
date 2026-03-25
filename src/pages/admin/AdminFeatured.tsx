import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  useAdminFeaturedRequests,
  useAdminRespondFeatured,
  useAdminRejectFeatured,
} from "@/hooks/useFeatured";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
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
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

const STATUS_TABS = ["pending_approval", "fee_proposed", "active", "rejected", "expired", "cancelled"] as const;
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_approval: { label: "Pending", color: "bg-amber-100 text-amber-700" },
  fee_proposed: { label: "Fee Proposed", color: "bg-blue-100 text-blue-700" },
  active: { label: "Active", color: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-600" },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-600" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600" },
};

const AdminFeatured = () => {
  const { profile, currentApartment } = useUser();
  const aptId = currentApartment?.id;

  const { data: requests, isLoading } = useAdminFeaturedRequests(aptId);
  const respondFeatured = useAdminRespondFeatured();
  const rejectFeatured = useAdminRejectFeatured();

  const [activeTab, setActiveTab] = useState("pending_approval");
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [adFee, setAdFee] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const filtered = requests?.filter((r) => r.status === activeTab) ?? [];

  const pendingCount = requests?.filter((r) => r.status === "pending_approval").length ?? 0;

  const openProposeFee = (req: any) => {
    setSelectedReq(req);
    setAdFee("");
    setValidFrom("");
    setValidUntil("");
    setAdminNotes("");
  };

  const handleProposeFee = async () => {
    if (!selectedReq || !adFee || !validFrom || !validUntil || !profile) return;
    try {
      await respondFeatured.mutateAsync({
        listingId: selectedReq.id,
        adFee: parseFloat(adFee),
        validFrom,
        validUntil,
        adminNotes: adminNotes || undefined,
        respondedBy: profile.id,
      });
      toast.success("Fee proposed to provider");
      setSelectedReq(null);
    } catch {
      toast.error("Failed to propose fee");
    }
  };

  const handleReject = async (reqId: string) => {
    if (!profile) return;
    try {
      await rejectFeatured.mutateAsync({
        listingId: reqId,
        adminNotes: "Rejected by admin",
        respondedBy: profile.id,
      });
      toast.success("Request rejected");
    } catch {
      toast.error("Failed to reject");
    }
  };

  const getProviderName = (req: any) => {
    const par = req.provider_apartment_registrations as any;
    return par?.service_providers?.business_name || par?.service_providers?.users?.full_name || "Provider";
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-amber-500" />
          <h2 className="text-lg font-bold">Featured Listings</h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_TABS.map((tab) => {
            const st = STATUS_LABELS[tab];
            const count = requests?.filter((r) => r.status === tab).length ?? 0;
            if (count === 0 && tab !== "pending_approval" && tab !== "active") return null;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {st.label} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((req) => {
              const st = STATUS_LABELS[req.status ?? ""] ?? { label: req.status, color: "bg-gray-100 text-gray-600" };
              return (
                <Card key={req.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{(req.classes as any)?.title}</p>
                      <p className="text-xs text-muted-foreground">{getProviderName(req)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Requested {new Date(req.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <Badge className={`text-[10px] border-0 shrink-0 ${st.color}`}>{st.label}</Badge>
                  </div>

                  {req.banner_image_url && (
                    <img src={req.banner_image_url} alt="Banner" className="w-full rounded-lg aspect-[3/1] object-cover" />
                  )}

                  {/* Show proposed fee details for fee_proposed/active */}
                  {(req.status === "fee_proposed" || req.status === "active") && req.ad_fee && (
                    <div className="text-xs space-y-1 rounded-lg bg-muted/50 p-2">
                      <p>Ad Fee: <span className="font-semibold">₹{req.ad_fee}</span></p>
                      {req.valid_from && req.valid_until && (
                        <p>
                          {new Date(req.valid_from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {" — "}
                          {new Date(req.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                      {req.admin_notes && <p className="text-muted-foreground">Note: {req.admin_notes}</p>}
                    </div>
                  )}

                  {/* Actions for pending requests */}
                  {req.status === "pending_approval" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs text-destructive border-destructive"
                        onClick={() => handleReject(req.id)}
                        disabled={rejectFeatured.isPending}
                      >
                        <X size={14} className="mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => openProposeFee(req)}
                      >
                        <Check size={14} className="mr-1" /> Propose Fee
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Sparkles size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {activeTab === "pending_approval" ? "No pending featured requests" : `No ${STATUS_LABELS[activeTab]?.label.toLowerCase()} listings`}
            </p>
          </div>
        )}
      </div>

      {/* Propose Fee Sheet */}
      <Sheet open={!!selectedReq} onOpenChange={() => setSelectedReq(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Propose Ad Fee</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            {selectedReq && (
              <div className="space-y-1">
                <p className="text-sm font-semibold">{(selectedReq.classes as any)?.title}</p>
                <p className="text-xs text-muted-foreground">By {getProviderName(selectedReq)}</p>
                {selectedReq.banner_image_url && (
                  <img src={selectedReq.banner_image_url} alt="Banner" className="w-full rounded-lg aspect-[3/1] object-cover mt-2" />
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Ad Fee (₹)</Label>
              <Input
                type="number"
                value={adFee}
                onChange={(e) => setAdFee(e.target.value)}
                placeholder="e.g. 500"
                className="h-10 rounded-lg"
              />
              <p className="text-[10px] text-muted-foreground">One-time fee charged to the provider for featured placement</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valid From</Label>
                <Input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valid Until</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Any terms or conditions..."
                rows={2}
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleProposeFee}
              disabled={!adFee || !validFrom || !validUntil || respondFeatured.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
            >
              {respondFeatured.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Propose Fee to Provider"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav persona="admin" />
    </div>
  );
};

export default AdminFeatured;
