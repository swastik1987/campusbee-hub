import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  usePlatformSponsoredRequests,
  useApproveSponsored,
  useRejectSponsored,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MapPin, Megaphone, XCircle } from "lucide-react";
import { toast } from "sonner";

type TabValue = "pending" | "approved" | "rejected";

const TABS: { label: string; value: TabValue }[] = [
  { label: "Pending", value: "pending" },
  { label: "Active", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const PlatformSponsored = () => {
  const { profile } = useUser();
  const [activeTab, setActiveTab] = useState<TabValue>("pending");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [slotPosition, setSlotPosition] = useState("1");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: listings, isLoading, error, refetch } = usePlatformSponsoredRequests(activeTab);
  const approve = useApproveSponsored();
  const reject = useRejectSponsored();

  const today = new Date().toISOString().split("T")[0];

  const handleApprove = async () => {
    if (!approveId || !profile || !validFrom || !validUntil) return;
    try {
      await approve.mutateAsync({
        listingId: approveId,
        reviewedBy: profile.id,
        slotPosition: parseInt(slotPosition),
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
      });
      toast.success("Sponsored listing approved");
      setApproveId(null);
    } catch {
      toast.error("Failed to approve listing");
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
      toast.success("Listing rejected");
      setRejectId(null);
      setRejectReason("");
    } catch {
      toast.error("Failed to reject listing");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Sponsored Listings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Approve featured slot requests from Premium providers (top-3 spots in Explore)
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
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
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">Failed to load listings</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : !(listings as any[])?.length ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Megaphone size={44} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No {activeTab === "approved" ? "active" : activeTab} sponsored requests
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(listings as any[]).map((listing) => {
            const cls = listing.classes;
            const provider = listing.service_providers;
            return (
              <Card key={listing.id} className="p-4 space-y-3">
                {/* Class + provider row */}
                <div className="flex items-start gap-3">
                  {cls?.cover_image_url ? (
                    <img
                      src={cls.cover_image_url}
                      alt={cls.title}
                      className="h-14 w-20 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-14 w-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Megaphone size={20} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold line-clamp-1">{cls?.title}</p>
                    <p className="text-xs text-muted-foreground">{provider?.business_name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin size={10} />
                        {listing.radius_km} km radius
                      </span>
                      {listing.slot_position != null && (
                        <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-800 border-0">
                          Slot #{listing.slot_position}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(listing.requested_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })}
                  </span>
                </div>

                {/* Payment reference */}
                {listing.off_app_payment_ref && (
                  <div className="rounded-lg bg-muted/60 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">Payment Reference</p>
                    <p className="text-xs font-mono font-semibold">{listing.off_app_payment_ref}</p>
                  </div>
                )}

                {/* Validity period */}
                {listing.valid_from && listing.valid_until && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="font-medium">Active:</span>
                    {new Date(listing.valid_from).toLocaleDateString("en-IN")}
                    {" → "}
                    {new Date(listing.valid_until).toLocaleDateString("en-IN")}
                  </p>
                )}

                {/* Rejection reason */}
                {listing.rejection_reason && (
                  <p className="text-xs text-red-600 italic">{listing.rejection_reason}</p>
                )}

                {/* Actions */}
                {activeTab === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => {
                        setApproveId(listing.id);
                        setSlotPosition("1");
                        setValidFrom(today);
                        setValidUntil("");
                      }}
                    >
                      <Megaphone size={14} />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => { setRejectId(listing.id); setRejectReason(""); }}
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

      {/* Approve sheet */}
      <Sheet
        open={!!approveId}
        onOpenChange={(open) => { if (!open) setApproveId(null); }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2">
              <Megaphone size={18} className="text-indigo-600" />
              Approve Sponsored Listing
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Slot Position <span className="text-destructive">*</span>
              </Label>
              <Select value={slotPosition} onValueChange={setSlotPosition}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Slot 1 — Top of Explore</SelectItem>
                  <SelectItem value="2">Slot 2</SelectItem>
                  <SelectItem value="3">Slot 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Valid From <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  min={today}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Valid Until <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  min={validFrom || today}
                  className="h-11"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The listing becomes "active" immediately upon approval and expires on the date above.
            </p>
            <Button
              className="w-full h-11 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleApprove}
              disabled={!validFrom || !validUntil || approve.isPending}
            >
              {approve.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Megaphone size={16} />
              )}
              Confirm Approval
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reject sheet */}
      <Sheet
        open={!!rejectId}
        onOpenChange={(open) => { if (!open) { setRejectId(null); setRejectReason(""); } }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle>Reject Listing</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Reason{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (shown to provider)…"
                rows={3}
                className="resize-none"
              />
            </div>
            <Button
              className="w-full h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              onClick={handleReject}
              disabled={reject.isPending}
            >
              {reject.isPending && <Loader2 size={16} className="animate-spin" />}
              Confirm Rejection
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PlatformSponsored;
