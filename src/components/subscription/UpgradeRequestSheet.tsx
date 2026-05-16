import React, { useEffect, useState } from "react";
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
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  Crown,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

// ── Premium benefits ─────────────────────────────────────────────────────────
const PREMIUM_BENEFITS = [
  {
    icon: CreditCard,
    title: "In-app payment collection",
    description: "Collect class fees directly through CampusBee — no chasing UPI screenshots.",
    example:
      "Send a learner a payment request; they pay via UPI in the app and you see it instantly under Payments.",
    accent: "from-emerald-100 to-emerald-50",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
  },
  {
    icon: Bell,
    title: "Automated payment reminders",
    description: "Auto-nudge learners with overdue fees so you don't have to chase manually.",
    example: "A reminder fires 3 days before the due date and again the morning of.",
    accent: "from-amber-100 to-amber-50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
  },
  {
    icon: UserPlus,
    title: "Onboard coaches",
    description: "Invite multiple coaches to manage batches, mark attendance, and send reminders.",
    example: "Coach Anjali signs in and sees only the Saturday-morning batch she's assigned to.",
    accent: "from-indigo-100 to-indigo-50",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-700",
  },
  {
    icon: BarChart3,
    title: "Advanced analytics",
    description: "Revenue trends, retention curves, attendance heatmaps, and growth insights.",
    example: "Spot which batches retain students best across the last 6 months.",
    accent: "from-violet-100 to-violet-50",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-700",
  },
  {
    icon: Compass,
    title: "Competitor analysis",
    description: "See pricing, ratings, and density of similar classes around your location.",
    example: "5 other Bharatanatyam classes within 3 km · average fee ₹2,400/month.",
    accent: "from-sky-100 to-sky-50",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-700",
  },
  {
    icon: Sparkles,
    title: "Sponsored listings",
    description: "Top-3 placement in nearby Explore with a gold \"Featured\" tag.",
    example: "Your class appears at the very top for every learner within a 5 km radius.",
    accent: "from-amber-100 to-orange-50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
  },
  {
    icon: ImageIcon,
    title: "Featured banner placements",
    description: "Eye-catching banner art on Explore and category pages.",
    example: "Custom 16:9 artwork rotates on the seeker home screen and category landing pages.",
    accent: "from-pink-100 to-pink-50",
    iconBg: "bg-pink-100",
    iconColor: "text-pink-700",
  },
] as const;

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
    // Two-step flow: lead with benefits, then payment form on continue.
    const [view, setView] = useState<"benefits" | "pay">("benefits");

    // Reset to benefits view every time the sheet (re)opens.
    useEffect(() => {
      if (open) setView("benefits");
    }, [open]);

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
              {view === "pay" && !hasPending && (
                <button
                  onClick={() => setView("benefits")}
                  className="mr-1 flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent"
                  title="Back to benefits"
                >
                  <ArrowLeft size={14} />
                </button>
              )}
              <Crown size={18} className="text-amber-500" />
              {view === "pay" && !hasPending ? "Complete Payment" : "Upgrade to Premium"}
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
          ) : view === "benefits" ? (
            /* ── Benefits screen ────────────────────────────────────────── */
            <div className="space-y-4">
              {/* Hero */}
              <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Crown size={16} className="text-amber-600" />
                  <p className="text-sm font-bold text-amber-900">
                    Everything in Premium
                  </p>
                </div>
                <p className="text-xs text-amber-800">
                  Grow your business with payment collection, analytics, sponsored slots, and a
                  Coach team — all in one upgrade.
                </p>
              </div>

              {/* Benefit cards */}
              <div className="space-y-2.5">
                {PREMIUM_BENEFITS.map((b) => {
                  const Icon = b.icon;
                  return (
                    <div
                      key={b.title}
                      className={`rounded-xl border bg-gradient-to-br ${b.accent} p-3.5`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${b.iconBg}`}
                        >
                          <Icon size={16} className={b.iconColor} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-foreground leading-tight">
                            {b.title}
                          </p>
                          <p className="text-[11px] text-foreground/80 leading-snug">
                            {b.description}
                          </p>
                          <p className="text-[10px] italic text-muted-foreground leading-snug">
                            {b.example}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pricing line */}
              <p className="text-center text-[11px] text-muted-foreground">
                Pricing on request · Activation within 24 hours of payment verification.
              </p>

              {/* CTAs */}
              <div className="space-y-2 pt-1">
                <Button
                  className="w-full h-11 gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => setView("pay")}
                >
                  <Crown size={16} />
                  Continue to Upgrade
                  <ArrowRight size={14} />
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-9 text-xs text-muted-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  Maybe later
                </Button>
              </div>
            </div>
          ) : (
            /* ── Payment / submission form ──────────────────────────────── */
            <div className="space-y-5">
              {/* Plan reminder + back to benefits */}
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-3">
                <div className="flex items-center gap-2">
                  <Crown size={14} className="text-amber-600" />
                  <p className="text-xs font-semibold text-amber-900">Premium upgrade</p>
                </div>
                <button
                  onClick={() => setView("benefits")}
                  className="flex items-center gap-1 text-[10px] font-medium text-amber-700 hover:text-amber-900"
                >
                  Review benefits
                  <ChevronRight size={11} />
                </button>
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
