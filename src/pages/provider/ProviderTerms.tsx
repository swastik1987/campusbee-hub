import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useRespondToClassTerms } from "@/hooks/useProvider";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ProviderTerms = React.forwardRef<HTMLDivElement, Record<string, never>>((_props, ref) => {
  const navigate = useNavigate();
  const { classId } = useParams<{ classId: string }>();
  const respondToClassTerms = useRespondToClassTerms();
  const [responding, setResponding] = React.useState(false);

  const { data: cls, isLoading } = useQuery({
    queryKey: ["class-terms", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, class_terms_status,
          class_fee_type, class_fee_amount, class_revenue_share_pct,
          class_payment_frequency, class_commercial_notes,
          provider_apartment_registrations(
            apartment_complexes(name, city, locality)
          )
        `)
        .eq("id", classId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const handleRespond = async (accept: boolean) => {
    if (!classId) return;
    setResponding(true);
    try {
      await respondToClassTerms.mutateAsync({ classId, accept });
      if (accept) {
        toast.success("Terms accepted! Class is now published.");
      } else {
        toast.success("Terms rejected. Admin will be notified.");
      }
      navigate(-1);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setResponding(false);
    }
  };

  const apt = (cls as any)?.provider_apartment_registrations?.apartment_complexes;

  return (
    <div ref={ref} className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg p-4">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold">Commercial Terms</h1>
        </div>

        {isLoading && (
          <Card className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-10 w-1/2" />
            </div>
          </Card>
        )}

        {!isLoading && !cls && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <FileText size={32} className="text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Terms not found</h2>
          </div>
        )}

        {!isLoading && cls && (
          <Card className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-base">{cls.title}</h3>
              {apt && (
                <p className="text-sm text-muted-foreground">
                  {apt.name} · {apt.locality}, {apt.city}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Commercial Details
              </h4>
              <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
                {cls.class_fee_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fee Type</span>
                    <span className="font-medium capitalize">{cls.class_fee_type}</span>
                  </div>
                )}
                {cls.class_fee_amount != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fee Amount</span>
                    <span className="font-medium">
                      {cls.class_fee_type === "percentage"
                        ? `${cls.class_fee_amount}%`
                        : `₹${cls.class_fee_amount}`}
                    </span>
                  </div>
                )}
                {cls.class_revenue_share_pct != null && cls.class_revenue_share_pct > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue Share</span>
                    <span className="font-medium">{cls.class_revenue_share_pct}%</span>
                  </div>
                )}
                {cls.class_payment_frequency && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Frequency</span>
                    <span className="font-medium capitalize">{cls.class_payment_frequency}</span>
                  </div>
                )}
                {cls.class_commercial_notes && (
                  <div className="pt-1 border-t">
                    <span className="text-muted-foreground">Notes</span>
                    <p className="mt-1 font-medium">{cls.class_commercial_notes}</p>
                  </div>
                )}
              </div>
            </div>

            {cls.class_terms_status === "pending_acceptance" && (
              <div className="flex gap-3 pt-1">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleRespond(true)}
                  disabled={responding}
                >
                  {responding ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle2 size={16} className="mr-2" />}
                  Accept Terms
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleRespond(false)}
                  disabled={responding}
                >
                  {responding ? <Loader2 size={16} className="mr-2 animate-spin" /> : <XCircle size={16} className="mr-2" />}
                  Reject
                </Button>
              </div>
            )}

            {cls.class_terms_status === "accepted" && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle2 size={16} />
                Terms accepted
              </div>
            )}

            {cls.class_terms_status === "rejected" && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <XCircle size={16} />
                Terms rejected
              </div>
            )}
          </Card>
        )}
      </div>

      <BottomNav persona="provider" />
    </div>
  );
});

ProviderTerms.displayName = "ProviderTerms";

export default ProviderTerms;
