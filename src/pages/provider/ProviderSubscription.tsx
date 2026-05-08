import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { useMySubscriptionRequests } from "@/hooks/useSubscription";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import UpgradeRequestSheet from "@/components/subscription/UpgradeRequestSheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Megaphone,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

// ── Premium feature list ─────────────────────────────────────────────────────

const PREMIUM_FEATURES = [
  {
    icon: CreditCard,
    label: "In-app Payment Collection",
    desc: "Collect fees directly through the app",
  },
  {
    icon: Zap,
    label: "Automated Payment Reminders",
    desc: "Auto-remind students on due dates",
  },
  {
    icon: BarChart3,
    label: "Advanced Analytics",
    desc: "Revenue trends & retention analysis",
  },
  {
    icon: Target,
    label: "Competitor Analysis",
    desc: "Compare pricing and reach nearby competitors",
  },
  {
    icon: TrendingUp,
    label: "Growth Insights",
    desc: "Seller insights to grow your business",
  },
  {
    icon: Megaphone,
    label: "Sponsored Listings",
    desc: "Feature in top-3 spots on Explore",
  },
  {
    icon: BadgeCheck,
    label: "Featured Banner Placements",
    desc: "Prominent banner across the platform",
  },
];

// ── Request status meta ──────────────────────────────────────────────────────

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  pending:  { label: "Pending Review", color: "bg-amber-100 text-amber-700",  icon: Clock },
  approved: { label: "Approved",        color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  rejected: { label: "Rejected",        color: "bg-red-100 text-red-700",      icon: XCircle },
};

// ── Page ─────────────────────────────────────────────────────────────────────

const ProviderSubscription = () => {
  const { providerProfile, isPremium } = useUser();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: requests, isLoading } = useMySubscriptionRequests(providerProfile?.id);

  const validUntil = providerProfile?.subscription_valid_until
    ? new Date(providerProfile.subscription_valid_until)
    : null;

  const hasPending = requests?.some((r) => r.status === "pending");

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-6">
        {/* Page header */}
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Crown size={20} className="text-amber-500" />
            Subscription
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your plan and unlock Premium features
          </p>
        </div>

        {/* Current tier card */}
        <Card
          className={`p-5 ${
            isPremium
              ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50"
              : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Current Plan</p>
              <div className="flex items-center gap-2">
                {isPremium ? (
                  <>
                    <Crown size={18} className="text-amber-600" />
                    <p className="text-xl font-bold text-amber-900">Premium</p>
                  </>
                ) : (
                  <>
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                    </div>
                    <p className="text-xl font-bold">Basic</p>
                  </>
                )}
              </div>
              {isPremium && validUntil && (
                <p className="text-xs text-amber-700 mt-1">
                  Active until{" "}
                  {validUntil.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              {!isPremium && (
                <p className="text-xs text-muted-foreground mt-1">
                  Free · Upgrade to unlock all features
                </p>
              )}
            </div>

            {isPremium ? (
              <Badge className="bg-amber-500 text-white border-0 shrink-0">
                <Crown size={10} className="mr-1" />
                Premium
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 text-muted-foreground">
                Free
              </Badge>
            )}
          </div>

          {!isPremium && (
            <Button
              className="mt-4 w-full h-10 gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => setSheetOpen(true)}
              disabled={hasPending}
            >
              <Crown size={15} />
              {hasPending ? "Request Pending…" : "Upgrade to Premium"}
            </Button>
          )}
        </Card>

        {/* Features comparison */}
        <div>
          <p className="text-sm font-semibold mb-3">What's included in Premium</p>
          <Card className="divide-y">
            {PREMIUM_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 p-3">
                <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
                {isPremium ? (
                  <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/25 shrink-0" />
                )}
              </div>
            ))}
          </Card>
        </div>

        {/* Request history */}
        {(isLoading || (requests && requests.length > 0)) && (
          <div>
            <p className="text-sm font-semibold mb-3">Request History</p>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(requests ?? []).map((req) => {
                  const meta = STATUS_META[req.status] ?? STATUS_META.pending;
                  const StatusIcon = meta.icon;
                  return (
                    <Card key={req.id} className="p-3 flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}
                      >
                        <StatusIcon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium capitalize">
                            {req.requested_tier} Upgrade
                          </p>
                          <Badge
                            className={`text-[10px] h-4 px-1.5 border-0 ${meta.color}`}
                          >
                            {meta.label}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Requested{" "}
                          {new Date(req.requested_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {req.granted_until &&
                            ` · Valid until ${new Date(req.granted_until).toLocaleDateString(
                              "en-IN",
                              { day: "numeric", month: "short", year: "numeric" }
                            )}`}
                        </p>
                        {req.off_app_payment_ref && (
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Ref: {req.off_app_payment_ref}
                          </p>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CTA for basic providers with no history */}
        {!isPremium && !isLoading && (!requests || requests.length === 0) && (
          <p className="text-center text-xs text-muted-foreground pb-2">
            No upgrade requests yet. Tap "Upgrade to Premium" above to get started.
          </p>
        )}
      </div>

      <UpgradeRequestSheet open={sheetOpen} onOpenChange={setSheetOpen} />
      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderSubscription;
