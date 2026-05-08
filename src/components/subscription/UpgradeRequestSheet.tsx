import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useMySubscriptionRequests, useRequestPremiumUpgrade } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Clock, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ── Payment instructions — update before going live ─────────────────────────
const UPI_ID = "campusbee@ybl";
const BANK_DETAILS = "A/C: 1234567890  |  IFSC: SBIN0001234  |  State Bank of India";

interface UpgradeRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UpgradeRequestSheet = React.forwardRef<HTMLDivElement, UpgradeRequestSheetProps>(
  ({ open, onOpenChange }, ref) => {
    const { providerProfile } = useUser();
    const { data: requests } = useMySubscriptionRequests(providerProfile?.id);
    const upgrade = useRequestPremiumUpgrade();
    const navigate = useNavigate();

    const [notes, setNotes] = useState("");
    const [paymentRef, setPaymentRef] = useState("");

    const hasPending = requests?.some((r) => r.status === "pending");

    const handleSubmit = async () => {
      try {
        await upgrade.mutateAsync({
          notes: notes.trim() || undefined,
          offAppPaymentRef: paymentRef.trim() || undefined,
        });
        toast.success("Upgrade request submitted! We'll review it within 24 hours.");
        onOpenChange(false);
        setNotes("");
        setPaymentRef("");
        navigate("/provider/subscription");
      } catch {
        toast.error("Failed to submit request. Please try again.");
      }
    };

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-8 max-h-[90vh] overflow-y-auto"
        >
          {/* Hidden ref anchor so forwardRef is honoured */}
          <div ref={ref} />

          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2">
              <Crown size={18} className="text-amber-500" />
              Upgrade to Premium
            </SheetTitle>
          </SheetHeader>

          {hasPending ? (
            /* ── Pending state ──────────────────────────────────────────── */
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                <Clock size={24} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Request Under Review</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Your upgrade request is pending review. We'll notify you within 24 hours.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/provider/subscription");
                }}
              >
                View Request Status
              </Button>
            </div>
          ) : (
            /* ── Submission form ────────────────────────────────────────── */
            <div className="space-y-5">
              {/* Premium highlight */}
              <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Crown size={16} className="text-amber-600" />
                  <p className="text-sm font-bold text-amber-900">Premium Plan</p>
                </div>
                <p className="text-xs text-amber-700">
                  Contact us for pricing · Activation within 24 h of payment verification
                </p>
              </div>

              {/* Payment instructions */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Payment Instructions
                </p>
                <div className="rounded-lg bg-muted/60 p-3 space-y-2.5">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">UPI ID</p>
                    <p className="text-sm font-mono font-semibold">{UPI_ID}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Bank Transfer</p>
                    <p className="text-xs font-mono">{BANK_DETAILS}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    Add your business name in the payment remarks for faster processing.
                  </p>
                </div>
              </div>

              {/* Payment reference */}
              <div className="space-y-2">
                <Label>
                  Payment Reference{" "}
                  <span className="text-muted-foreground font-normal text-xs">(UPI TXN ID / UTR)</span>
                </Label>
                <Input
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. 123456789012"
                  className="h-11"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>
                  Notes{" "}
                  <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you'd like to share with our team…"
                  rows={2}
                  className="resize-none"
                />
              </div>

              <Button
                className="w-full h-11 gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleSubmit}
                disabled={upgrade.isPending}
              >
                {upgrade.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Crown size={16} />
                )}
                Submit Upgrade Request
              </Button>

              <p className="text-center text-[10px] text-muted-foreground">
                Our team will verify your payment and activate Premium within 24 hours.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }
);

UpgradeRequestSheet.displayName = "UpgradeRequestSheet";

export default UpgradeRequestSheet;
