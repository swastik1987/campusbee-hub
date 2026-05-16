import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  usePlatformSubscriptionRequests,
  useApproveSubscription,
  useRejectSubscription,
} from "@/hooks/usePlatformAdmin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Calendar, Crown, Loader2, Repeat, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";

type TabValue = "pending" | "approved" | "rejected";

const TABS: { label: string; value: TabValue }[] = [
  { label: "Pending", value: "pending" },
  { label: "Active", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const PlatformSubscriptions = () => {
  const { profile } = useUser();
  const [activeTab, setActiveTab] = useState<TabValue>("pending");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [grantedUntil, setGrantedUntil] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: requests, isLoading, error, refetch } = usePlatformSubscriptionRequests(activeTab);
  const approve = useApproveSubscription();
  const reject = useRejectSubscription();

  const handleApprove = async () => {
    if (!approveId || !profile) return;
    try {
      await approve.mutateAsync({
        requestId: approveId,
        // If the admin entered an explicit date, use it; otherwise the RPC
        // derives the expiry from the request's billing_period (30 / 365 days).
        grantedUntil: grantedUntil ? new Date(grantedUntil).toISOString() : undefined,
      });
      toast.success("Subscription approved — provider upgraded to Premium");
      setApproveId(null);
      setGrantedUntil("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve subscription";
      toast.error(msg);
    }
  };

  const handleReject = async () => {
    if (!rejectId || !profile) return;
    try {
      await reject.mutateAsync({
        requestId: rejectId,
        reviewedBy: profile.id,
        notes: rejectNotes || undefined,
      });
      toast.success("Request rejected");
      setRejectId(null);
      setRejectNotes("");
    } catch {
      toast.error("Failed to reject request");
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Subscription Requests</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Review and approve Premium upgrade requests from providers
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
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">Failed to load requests</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : !(requests as any[])?.length ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Crown size={44} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No {activeTab === "approved" ? "active" : activeTab} subscription requests
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(requests as any[]).map((req) => {
            const provider = req.service_providers;
            const user = provider?.users;
            const isApproved = req.status === "approved";
            return (
              <Card key={req.id} className="p-4 space-y-3">
                {/* Provider row */}
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                      {provider?.business_name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{provider?.business_name}</p>
                      <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px] gap-0.5">
                        <Crown size={9} />
                        Premium Request
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {user?.full_name}
                      {user?.email && ` · ${user.email}`}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(req.requested_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })}
                  </span>
                </div>

                {/* Plan + amount paid */}
                {(req.billing_period || req.amount_paid != null) && (
                  <div className="flex flex-wrap gap-2">
                    {req.billing_period && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                        <Repeat size={10} />
                        <span className="capitalize">{req.billing_period}</span>
                      </span>
                    )}
                    {req.amount_paid != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <Wallet size={10} />
                        ₹{Number(req.amount_paid).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                )}

                {/* Payment reference */}
                {req.off_app_payment_ref && (
                  <div className="rounded-lg bg-muted/60 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">Payment Reference</p>
                    <p className="text-xs font-mono font-semibold">{req.off_app_payment_ref}</p>
                  </div>
                )}

                {/* Notes */}
                {req.notes && (
                  <p className="text-xs text-muted-foreground italic">"{req.notes}"</p>
                )}

                {/* Approval dates */}
                {isApproved && req.granted_until && (
                  <div className="flex items-center gap-1.5 text-xs text-green-700">
                    <Calendar size={12} />
                    Valid until:{" "}
                    {new Date(req.granted_until).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                )}

                {/* Rejection notes */}
                {req.status === "rejected" && req.notes && (
                  <p className="text-xs text-red-600 italic">Reason: {req.notes}</p>
                )}

                {/* Actions — pending only */}
                {activeTab === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => { setApproveId(req.id); setGrantedUntil(""); }}
                    >
                      <Crown size={14} />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => { setRejectId(req.id); setRejectNotes(""); }}
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
        onOpenChange={(open) => { if (!open) { setApproveId(null); setGrantedUntil(""); } }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2">
              <Crown size={18} className="text-amber-600" />
              Approve Premium Subscription
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Premium Valid Until{" "}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </Label>
              <Input
                type="date"
                value={grantedUntil}
                onChange={(e) => setGrantedUntil(e.target.value)}
                min={today}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-set from the chosen plan (Monthly → +30 days, Annual → +365 days).
                Subscription will auto-expire on this date.
              </p>
            </div>
            <Button
              className="w-full h-11 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleApprove}
              disabled={approve.isPending}
            >
              {approve.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Crown size={16} />
              )}
              Confirm Approval
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reject sheet */}
      <Sheet
        open={!!rejectId}
        onOpenChange={(open) => { if (!open) { setRejectId(null); setRejectNotes(""); } }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle>Reject Request</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Reason{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Reason for rejection (sent to provider)…"
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

export default PlatformSubscriptions;
