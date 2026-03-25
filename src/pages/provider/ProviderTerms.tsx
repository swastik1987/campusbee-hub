import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useProviderPendingTerms, useRespondToTerms } from "@/hooks/useProvider";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ProviderTerms = () => {
  const navigate = useNavigate();
  const { providerProfile } = useUser();
  const providerId = providerProfile?.id;

  const { data: pendingTerms, isLoading } = useProviderPendingTerms(providerId);
  const respondToTerms = useRespondToTerms();

  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondingAction, setRespondingAction] = useState<"accept" | "reject" | null>(null);

  const handleRespond = async (registrationId: string, accept: boolean) => {
    setRespondingId(registrationId);
    setRespondingAction(accept ? "accept" : "reject");
    try {
      await respondToTerms.mutateAsync({ registrationId, accept });
      if (accept) {
        toast.success("Terms accepted!");
      } else {
        toast.success("Terms rejected. The admin will be notified.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setRespondingId(null);
      setRespondingAction(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg p-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold">Commercial Terms</h1>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i} className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-1/2" />
                  <Skeleton className="h-10 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!pendingTerms || pendingTerms.length === 0) && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <FileText size={32} className="text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">No pending terms to review</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              When an apartment admin sends you commercial terms, they will appear here.
            </p>
          </div>
        )}

        {/* Terms Cards */}
        {!isLoading && pendingTerms && pendingTerms.length > 0 && (
          <div className="space-y-4">
            {pendingTerms.map((reg) => {
              const apartment = reg.apartment_complexes;
              const isResponding = respondingId === reg.id;

              return (
                <Card key={reg.id} className="p-4 space-y-4">
                  {/* Apartment Info + Version Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-base">
                        {apartment?.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {apartment?.locality}, {apartment?.city}
                      </p>
                    </div>
                    {reg.terms_version && (
                      <Badge variant="secondary" className="shrink-0">
                        v{reg.terms_version}
                      </Badge>
                    )}
                  </div>

                  {/* Commercial Details */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Commercial Details
                    </h4>
                    <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fee Type</span>
                        <span className="font-medium capitalize">
                          {reg.admin_fee_type}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fee Amount</span>
                        <span className="font-medium">
                          {reg.admin_fee_type === "percentage"
                            ? `${reg.admin_fee_amount}%`
                            : `₹${reg.admin_fee_amount}`}
                        </span>
                      </div>

                      {reg.min_guaranteed_fee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Min Guaranteed Fee
                          </span>
                          <span className="font-medium">
                            ₹{reg.min_guaranteed_fee}
                          </span>
                        </div>
                      )}

                      {reg.revenue_share_pct > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Revenue Share
                          </span>
                          <span className="font-medium">
                            {reg.revenue_share_pct}%
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Payment Frequency
                        </span>
                        <span className="font-medium capitalize">
                          {reg.payment_frequency}
                        </span>
                      </div>

                      {reg.free_trial_days > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Free Trial
                          </span>
                          <span className="font-medium">
                            {reg.free_trial_days} days
                          </span>
                        </div>
                      )}

                      {reg.commercial_notes && (
                        <div className="pt-1 border-t">
                          <span className="text-muted-foreground">Notes</span>
                          <p className="mt-1 font-medium">
                            {reg.commercial_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-1">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleRespond(reg.id, true)}
                      disabled={isResponding}
                    >
                      {isResponding && respondingAction === "accept" ? (
                        <Loader2 size={16} className="mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} className="mr-2" />
                      )}
                      Accept Terms
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleRespond(reg.id, false)}
                      disabled={isResponding}
                    >
                      {isResponding && respondingAction === "reject" ? (
                        <Loader2 size={16} className="mr-2 animate-spin" />
                      ) : (
                        <XCircle size={16} className="mr-2" />
                      )}
                      Reject Terms
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ProviderTerms;
