import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useMySubscriptionRequests,
  useRequestPremiumUpgrade,
  useActiveSubscriptionPlans,
  usePlatformPaymentDetails,
  type BillingPeriod,
} from "@/hooks/useSubscription";
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
  Check,
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

// Payment instructions are now admin-configurable via /platform/settings
// (subscription_plans + platform_payment_details).

const formatInr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

interface UpgradeRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UpgradeRequestSheet = React.forwardRef<HTMLDivElement, UpgradeRequestSheetProps>(
  ({ open, onOpenChange }, ref) => {
    const { providerProfile } = useUser();
    const { data: requests } = useMySubscriptionRequests(providerProfile?.id);
    const { data: plans, isLoading: plansLoading } = useActiveSubscriptionPlans();
    const { data: paymentDetails } = usePlatformPaymentDetails();
    const upgrade = useRequestPremiumUpgrade();
    const navigate = useNavigate();

    const [notes, setNotes] = useState("");
    const [paymentRef, setPaymentRef] = useState("");
    const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod | null>(null);
    // Three-step flow: benefits → plan → pay
    const [view, setView] = useState<"benefits" | "plan" | "pay">("benefits");

    // Reset state every time the sheet (re)opens.
    useEffect(() => {
      if (!open) return;
      setView("benefits");
      setSelectedPeriod(null);
      setNotes("");
      setPaymentRef("");
    }, [open]);

    const hasPending = requests?.some((r) => r.status === "pending");

    // Pre-pick the plan with the bigger discount on entry to the plan screen.
    const monthlyPlan = plans?.find((p) => p.billing_period === "monthly");
    const annualPlan = plans?.find((p) => p.billing_period === "annual");
    const plansConfigured = (plans?.length ?? 0) > 0;

    useEffect(() => {
      if (view !== "plan" || selectedPeriod) return;
      if (!annualPlan && !monthlyPlan) return;
      const monthlyDiscount = monthlyPlan && monthlyPlan.mrp > 0
        ? (monthlyPlan.mrp - monthlyPlan.price) / monthlyPlan.mrp : 0;
      const annualDiscount = annualPlan && annualPlan.mrp > 0
        ? (annualPlan.mrp - annualPlan.price) / annualPlan.mrp : 0;
      setSelectedPeriod(annualDiscount >= monthlyDiscount ? "annual" : "monthly");
    }, [view, selectedPeriod, monthlyPlan, annualPlan]);

    const selectedPlan = useMemo(
      () => plans?.find((p) => p.billing_period === selectedPeriod) ?? null,
      [plans, selectedPeriod],
    );

    const handleSubmit = async () => {
      if (!selectedPlan) {
        toast.error("Please select a plan");
        return;
      }
      try {
        await upgrade.mutateAsync({
          notes: notes.trim() || undefined,
          offAppPaymentRef: paymentRef.trim() || undefined,
          billingPeriod: selectedPlan.billing_period,
          amountPaid: selectedPlan.price,
        });
        toast.success("Upgrade request submitted! We'll review it within 24 hours.");
        onOpenChange(false);
        navigate("/provider/subscription");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to submit request.";
        toast.error(msg);
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
              {!hasPending && view !== "benefits" && (
                <button
                  onClick={() => setView(view === "pay" ? "plan" : "benefits")}
                  className="mr-1 flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent"
                  title="Back"
                >
                  <ArrowLeft size={14} />
                </button>
              )}
              <Crown size={18} className="text-amber-500" />
              {hasPending
                ? "Upgrade to Premium"
                : view === "pay"
                  ? "Complete Payment"
                  : view === "plan"
                    ? "Choose your plan"
                    : "Upgrade to Premium"}
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
                Choose a monthly or annual plan on the next step · Activation within 24 hours of payment verification.
              </p>

              {/* CTAs */}
              <div className="space-y-2 pt-1">
                <Button
                  className="w-full h-11 gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => setView("plan")}
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
          ) : view === "plan" ? (
            /* ── Plan picker ────────────────────────────────────────────── */
            <div className="space-y-4">
              {plansLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : !plansConfigured ? (
                /* Coming soon — no active plans configured by admin */
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                    <Clock size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      Premium pricing is being finalised
                    </p>
                    <p className="mt-1 text-xs text-amber-800 max-w-xs mx-auto">
                      We'll notify you the moment Premium becomes available. In the meantime,
                      keep building your classes on Basic.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                  >
                    Got it
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Pick a billing period. You can renew or change after the period ends.
                  </p>

                  <div className="space-y-3">
                    {(["monthly", "annual"] as const).map((period) => {
                      const plan = plans?.find((p) => p.billing_period === period);
                      if (!plan) return null;
                      const selected = selectedPeriod === period;
                      const hasDiscount = plan.mrp > 0 && plan.price < plan.mrp;
                      const savedAmount = hasDiscount ? plan.mrp - plan.price : 0;
                      const savedPct = hasDiscount ? Math.round((savedAmount / plan.mrp) * 100) : 0;
                      const monthlyEquivalent =
                        period === "annual" ? Math.round(plan.price / 12) : null;
                      const isAnnualBetter =
                        period === "annual" &&
                        monthlyPlan &&
                        monthlyEquivalent !== null &&
                        monthlyEquivalent < monthlyPlan.price;
                      return (
                        <button
                          key={period}
                          onClick={() => setSelectedPeriod(period)}
                          className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                            selected
                              ? "border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm"
                              : "border-border bg-card hover:border-amber-200"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold capitalize">{period}</p>
                                {period === "annual" && isAnnualBetter && (
                                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                    Best value
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {period === "monthly" ? "Billed every month" : "Billed once a year"}
                              </p>
                            </div>
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                                selected
                                  ? "border-amber-500 bg-amber-500 text-white"
                                  : "border-muted-foreground/30"
                              }`}
                            >
                              {selected && <Check size={13} strokeWidth={3} />}
                            </div>
                          </div>

                          <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-bold tracking-tight">
                              {formatInr(plan.price)}
                            </span>
                            {hasDiscount && (
                              <span className="text-sm text-muted-foreground line-through">
                                {formatInr(plan.mrp)}
                              </span>
                            )}
                            {hasDiscount && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Save {formatInr(savedAmount)} ({savedPct}%)
                              </span>
                            )}
                          </div>

                          {monthlyEquivalent !== null && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              ≈ {formatInr(monthlyEquivalent)}/month
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    className="w-full h-11 gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={() => setView("pay")}
                    disabled={!selectedPlan}
                  >
                    Continue with {selectedPeriod ?? "plan"}
                    <ArrowRight size={14} />
                  </Button>
                </>
              )}
            </div>
          ) : (
            /* ── Payment / submission form ──────────────────────────────── */
            <div className="space-y-5">
              {/* Plan summary + back to plan */}
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-3">
                <div className="flex items-center gap-2">
                  <Crown size={14} className="text-amber-600" />
                  <div>
                    <p className="text-xs font-semibold text-amber-900 capitalize">
                      {selectedPlan?.billing_period ?? "—"} plan
                    </p>
                    {selectedPlan && (
                      <p className="text-[10px] text-amber-800">
                        Pay {formatInr(selectedPlan.price)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setView("plan")}
                  className="flex items-center gap-1 text-[10px] font-medium text-amber-700 hover:text-amber-900"
                >
                  Change plan
                  <ChevronRight size={11} />
                </button>
              </div>

              {/* Big amount-due headline */}
              {selectedPlan && (
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Amount due
                  </p>
                  <p className="text-3xl font-bold tracking-tight">
                    {formatInr(selectedPlan.price)}
                  </p>
                </div>
              )}

              {/* Payment instructions — read from platform_payment_details */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Payment Instructions
                </p>
                <div className="rounded-lg bg-muted/60 p-3 space-y-3">
                  {paymentDetails?.upi_id ? (
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-0.5">UPI ID</p>
                        <p className="text-sm font-mono font-semibold break-all">
                          {paymentDetails.upi_id}
                        </p>
                      </div>
                      {paymentDetails.upi_qr_url && (
                        <img
                          src={paymentDetails.upi_qr_url}
                          alt="UPI QR"
                          className="h-20 w-20 shrink-0 rounded-lg border bg-white object-contain"
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] italic text-muted-foreground">
                      UPI not configured — contact the platform admin.
                    </p>
                  )}

                  {(paymentDetails?.bank_account || paymentDetails?.ifsc) && (
                    <div className="border-t pt-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Bank Transfer</p>
                      {paymentDetails.account_holder && (
                        <p className="text-xs">{paymentDetails.account_holder}</p>
                      )}
                      <p className="text-xs font-mono">
                        A/C: {paymentDetails.bank_account ?? "—"}
                        {paymentDetails.ifsc && ` · IFSC: ${paymentDetails.ifsc}`}
                      </p>
                      {paymentDetails.bank_name && (
                        <p className="text-xs">{paymentDetails.bank_name}</p>
                      )}
                    </div>
                  )}

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
                disabled={upgrade.isPending || !selectedPlan}
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
