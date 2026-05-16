import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useProviderPayments, useConfirmPayment, useDisputePayment } from "@/hooks/useEngagement";
import { useSendPaymentReminder } from "@/hooks/useCoaches";
import PremiumGate from "@/components/subscription/PremiumGate";
import UpgradeRequestSheet from "@/components/subscription/UpgradeRequestSheet";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Bell, Check, CreditCard, Crown, Loader2, Smartphone, Wallet, X } from "lucide-react";
import { toast } from "sonner";

const PAYMENT_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  recorded: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  disputed: "bg-red-100 text-red-700",
  refunded: "bg-amber-100 text-amber-700",
};

const ProviderPayments = () => {
  const navigate = useNavigate();
  const { profile, providerProfile, isPremium } = useUser();
  const [tab, setTab] = useState("recorded");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const { data: payments, isLoading } = useProviderPayments(
    providerProfile?.id,
    tab === "all" ? undefined : tab
  );

  const confirmPayment = useConfirmPayment();
  const disputePayment = useDisputePayment();
  const sendReminder = useSendPaymentReminder();
  const [reminderInFlight, setReminderInFlight] = useState<string | null>(null);

  const handleSendReminder = async (paymentId: string) => {
    setReminderInFlight(paymentId);
    try {
      await sendReminder.mutateAsync({ paymentId });
      toast.success("Reminder sent");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send reminder";
      toast.error(message);
    } finally {
      setReminderInFlight(null);
    }
  };

  const [disputeSheet, setDisputeSheet] = useState<string | null>(null);
  const [disputeNotes, setDisputeNotes] = useState("");

  const handleConfirm = async (paymentId: string) => {
    if (!profile) return;
    try {
      await confirmPayment.mutateAsync({ paymentId, confirmedBy: profile.id });
      toast.success("Payment confirmed");
    } catch {
      toast.error("Failed to confirm");
    }
  };

  const handleDispute = async () => {
    if (!disputeSheet || !disputeNotes.trim()) return;
    try {
      await disputePayment.mutateAsync({ paymentId: disputeSheet, notes: disputeNotes.trim() });
      toast.success("Payment disputed");
      setDisputeSheet(null);
      setDisputeNotes("");
    } catch {
      toast.error("Failed to dispute");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <h2 className="text-lg font-bold">Payments</h2>

        {/* Premium: Collect via App + Reminders ──────────────────────────── */}
        <PremiumGate
          featureName="In-app Collection"
          featureDescription="Send payment requests and reminders directly through CampusBee"
          fallback={
            <Card
              className="flex items-center gap-3 p-3 border-dashed border-amber-200 cursor-pointer hover:bg-amber-50/50 transition-colors"
              onClick={() => setUpgradeOpen(true)}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 shrink-0">
                <Crown size={16} className="text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Collect via App — Premium</p>
                <p className="text-[10px] text-muted-foreground">
                  Send payment requests &amp; automated reminders to students
                </p>
              </div>
              <Crown size={14} className="text-amber-400 shrink-0" />
            </Card>
          }
        >
          <Card className="p-4 space-y-3 border-amber-200 bg-amber-50/30">
            <div className="flex items-center gap-2">
              <Crown size={14} className="text-amber-600" />
              <p className="text-sm font-semibold text-amber-900">Premium Tools</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="flex flex-col items-center gap-1.5 rounded-lg bg-white border p-3 text-center hover:border-amber-300 transition-colors"
                onClick={() => navigate("/provider/payments")}
              >
                <Smartphone size={18} className="text-amber-600" />
                <span className="text-xs font-medium">Send Request</span>
                <span className="text-[10px] text-muted-foreground">Collect from student</span>
              </button>
              <button
                className="flex flex-col items-center gap-1.5 rounded-lg bg-white border p-3 text-center hover:border-amber-300 transition-colors"
                onClick={() => navigate("/provider/payments")}
              >
                <Bell size={18} className="text-amber-600" />
                <span className="text-xs font-medium">Send Reminders</span>
                <span className="text-[10px] text-muted-foreground">Notify overdue students</span>
              </button>
            </div>
          </Card>
        </PremiumGate>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="recorded" className="flex-1">Pending</TabsTrigger>
            <TabsTrigger value="confirmed" className="flex-1">Confirmed</TabsTrigger>
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : payments && payments.length > 0 ? (
              <div className="space-y-2">
                {payments.map((payment) => {
                  const payer = (payment as any).users;
                  const enrollment = payment.enrollments as any;
                  const memberName = enrollment?.family_members?.name;
                  const className = enrollment?.batches?.classes?.title;
                  const batchName = enrollment?.batches?.batch_name;

                  return (
                    <Card key={payment.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={payer?.avatar_url} />
                            <AvatarFallback className="text-[10px] bg-muted">
                              {payer?.full_name?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold">{payer?.full_name}</p>
                            {memberName && (
                              <p className="text-[10px] text-muted-foreground">for {memberName}</p>
                            )}
                          </div>
                        </div>
                        <Badge className={`text-[10px] border-0 ${PAYMENT_COLORS[payment.status ?? ""] ?? "bg-gray-100"}`}>
                          {payment.status}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">₹{payment.amount}</span>
                        <span className="text-xs text-muted-foreground capitalize">{payment.payment_type?.replace("_", " ")}</span>
                      </div>

                      {(className || batchName) && (
                        <p className="text-xs text-muted-foreground">
                          {className}{batchName && ` · ${batchName}`}
                        </p>
                      )}

                      {payment.upi_transaction_id && (
                        <p className="text-xs text-muted-foreground font-mono">
                          UPI Ref: {payment.upi_transaction_id}
                        </p>
                      )}

                      {payment.paid_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Paid: {new Date(payment.paid_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </p>
                      )}

                      {payment.receipt_url && (
                        <button
                          onClick={() => window.open(payment.receipt_url!, "_blank")}
                          className="text-xs text-primary font-medium"
                        >
                          View Screenshot
                        </button>
                      )}

                      {payment.status === "recorded" && (
                        <div className="space-y-2 pt-1">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs text-destructive border-destructive"
                              onClick={() => { setDisputeSheet(payment.id); setDisputeNotes(""); }}
                            >
                              <X size={14} className="mr-1" /> Dispute
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleConfirm(payment.id)}
                              disabled={confirmPayment.isPending}
                            >
                              {confirmPayment.isPending ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <><Check size={14} className="mr-1" /> Confirm</>
                              )}
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => handleSendReminder(payment.id)}
                            disabled={reminderInFlight === payment.id}
                          >
                            {reminderInFlight === payment.id ? (
                              <Loader2 size={14} className="animate-spin mr-1" />
                            ) : (
                              <Bell size={14} className="mr-1" />
                            )}
                            Send Reminder
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Wallet size={28} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {tab === "recorded" ? "No pending payments" : "No payment records"}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dispute Sheet */}
      <Sheet open={!!disputeSheet} onOpenChange={() => setDisputeSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Dispute Payment</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Input
                value={disputeNotes}
                onChange={(e) => setDisputeNotes(e.target.value)}
                placeholder="Why are you disputing this payment?"
                className="h-10 rounded-lg"
              />
            </div>
            <Button
              onClick={handleDispute}
              disabled={!disputeNotes.trim() || disputePayment.isPending}
              className="w-full bg-destructive text-white rounded-lg"
            >
              {disputePayment.isPending ? <Loader2 size={16} className="animate-spin" /> : "Dispute Payment"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <UpgradeRequestSheet open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderPayments;
