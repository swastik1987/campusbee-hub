import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useCreateEnrollment, useCreateWaitlistEntry, useRecordPayment } from "@/hooks/useSeeker";
import { useBatches, useBatchSchedules, useClassAddons } from "@/hooks/useClasses";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar, CheckCircle, Clock, Copy, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEE_LABELS: Record<string, string> = {
  per_session: "/session",
  monthly: "/month",
  quarterly: "/quarter",
  for_duration: " total",
  one_time: "",
};

const EnrollFlow = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { profile, familyMembers } = useUser();

  const [step, setStep] = useState(0);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [upiRef, setUpiRef] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);

  const createEnrollment = useCreateEnrollment();
  const createWaitlist = useCreateWaitlistEntry();
  const recordPayment = useRecordPayment();

  // Fetch batch details with class info
  const { data: batch } = useQuery({
    queryKey: ["enroll-batch", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select(`
          id, batch_name, skill_level, fee_amount, fee_frequency, status,
          max_batch_size, current_enrollment_count, registration_mode, auto_waitlist,
          start_date, end_date, trainer_id,
          trainers(id, name, photo_url),
          batch_schedules(day_of_week, start_time, end_time),
          classes(
            id, title, cover_image_url,
            class_addons(id, name, description, fee_amount, fee_type, is_mandatory, is_active),
            provider_apartment_registrations(
              service_providers(id, business_name, upi_id, upi_qr_image_url, whatsapp_number,
                users(full_name)
              )
            )
          )
        `)
        .eq("id", batchId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!batch || !profile) return null;

  const cls = batch.classes as any;
  const provider = cls?.provider_apartment_registrations?.service_providers;
  const schedules = batch.batch_schedules ?? [];
  const addons = (cls?.class_addons ?? []).filter((a: any) => a.is_active);
  const slotsLeft = batch.max_batch_size - (batch.current_enrollment_count ?? 0);
  const isFull = slotsLeft <= 0;

  // Initialize mandatory addons
  const mandatoryIds = addons.filter((a: any) => a.is_mandatory).map((a: any) => a.id);
  if (mandatoryIds.some((id: string) => !selectedAddonIds.includes(id))) {
    setSelectedAddonIds((prev) => [...new Set([...prev, ...mandatoryIds])]);
  }

  const toggleAddon = (id: string) => {
    if (mandatoryIds.includes(id)) return;
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedAddons = addons.filter((a: any) => selectedAddonIds.includes(a.id));
  const addonTotal = selectedAddons.reduce((sum: number, a: any) => sum + a.fee_amount, 0);
  const totalAmount = batch.fee_amount + addonTotal;

  const handleEnroll = async () => {
    if (!selectedMemberId || !profile) return;

    try {
      if (isFull && batch.auto_waitlist) {
        const result = await createWaitlist.mutateAsync({
          batchId: batch.id,
          familyMemberId: selectedMemberId,
          requestedBy: profile.id,
        });
        setWaitlistPosition(result.position);
        setStep(3); // success
        return;
      }

      const result = await createEnrollment.mutateAsync({
        batchId: batch.id,
        familyMemberId: selectedMemberId,
        enrolledBy: profile.id,
        selectedAddonIds,
      });
      setEnrollmentId(result.id);
      setStep(2); // payment
    } catch (err: any) {
      toast.error(err?.message || "Enrollment failed");
    }
  };

  const handleRecordPayment = async () => {
    if (!upiRef.trim() || !profile) return;
    try {
      await recordPayment.mutateAsync({
        enrollmentId,
        payerUserId: profile.id,
        providerId: provider?.id,
        amount: totalAmount,
        paymentType: "class_fee",
        upiTransactionId: upiRef.trim(),
      });
      setStep(3); // success
    } catch {
      toast.error("Failed to record payment");
    }
  };

  const copyUPI = () => {
    if (provider?.upi_id) {
      navigator.clipboard.writeText(provider.upi_id);
      toast.success("UPI ID copied");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => step > 0 && step < 3 ? setStep(step - 1) : navigate(-1)} className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">
          {step === 0 ? "Select Member" : step === 1 ? "Review" : step === 2 ? "Payment" : "Done"}
        </h1>
      </header>

      {/* Progress */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg px-6 py-4 space-y-5">
        {/* Step 0: Select family member */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="text-xl font-bold">Who is enrolling?</h2>
            <div className="space-y-2">
              {familyMembers.map((member) => (
                <Card
                  key={member.id}
                  className={`flex items-center gap-3 p-4 cursor-pointer transition-all ${
                    selectedMemberId === member.id ? "border-primary bg-primary/5" : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedMemberId(member.id)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {member.name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.relationship}
                      {member.age_group && ` · ${member.age_group}`}
                    </p>
                  </div>
                  {selectedMemberId === member.id && (
                    <CheckCircle size={20} className="text-primary" />
                  )}
                </Card>
              ))}
            </div>
            <Button
              disabled={!selectedMemberId}
              onClick={() => setStep(1)}
              className="w-full h-12 bg-primary text-white font-semibold rounded-xl"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 1: Review batch + addons */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="text-xl font-bold">Review & Confirm</h2>

            <Card className="p-4 space-y-2">
              <h3 className="font-semibold text-sm">{cls?.title}</h3>
              <p className="text-xs text-muted-foreground font-medium">{batch.batch_name}</p>
              {schedules.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar size={12} />
                  {schedules.map((s: any) => DAY_NAMES[s.day_of_week]).join(", ")}
                  <span>·</span>
                  <Clock size={12} />
                  {schedules[0]?.start_time?.slice(0, 5)}–{schedules[0]?.end_time?.slice(0, 5)}
                </div>
              )}
              {(batch.trainers as any)?.name && (
                <p className="text-xs text-muted-foreground">Trainer: {(batch.trainers as any).name}</p>
              )}
            </Card>

            <Card className="p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Enrolling</p>
              <p className="text-sm font-semibold">
                {familyMembers.find((m) => m.id === selectedMemberId)?.name}
              </p>
            </Card>

            {/* Addons */}
            {addons.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold">Add-ons</p>
                {addons.map((addon: any) => (
                  <div key={addon.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <Checkbox
                      checked={selectedAddonIds.includes(addon.id)}
                      onCheckedChange={() => toggleAddon(addon.id)}
                      disabled={addon.is_mandatory}
                    />
                    <div className="flex-1">
                      <p className="text-sm">{addon.name}</p>
                      {addon.description && <p className="text-xs text-muted-foreground">{addon.description}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">₹{addon.fee_amount}</p>
                      {addon.is_mandatory && <p className="text-[9px] text-destructive">Required</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Cost breakdown */}
            <Card className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Base fee</span>
                <span>₹{batch.fee_amount}{FEE_LABELS[batch.fee_frequency] ?? ""}</span>
              </div>
              {selectedAddons.map((a: any) => (
                <div key={a.id} className="flex justify-between text-sm text-muted-foreground">
                  <span>{a.name}</span>
                  <span>₹{a.fee_amount}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm pt-2 border-t">
                <span>Total</span>
                <span>₹{totalAmount}</span>
              </div>
            </Card>

            {isFull && (
              <Card className="p-3 border-amber-300 bg-amber-50">
                <p className="text-xs text-amber-700 font-medium">
                  This batch is full. You'll be added to the waitlist.
                </p>
              </Card>
            )}

            <Button
              onClick={handleEnroll}
              disabled={createEnrollment.isPending || createWaitlist.isPending}
              className="w-full h-12 bg-primary text-white font-semibold rounded-xl"
            >
              {createEnrollment.isPending || createWaitlist.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : isFull ? (
                "Join Waitlist"
              ) : (
                "Confirm & Pay"
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Payment */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="text-xl font-bold">Make Payment</h2>

            <Card className="p-4 text-center space-y-3">
              <p className="text-3xl font-bold">₹{totalAmount}</p>
              <p className="text-xs text-muted-foreground">Pay via UPI to the provider</p>
            </Card>

            {provider?.upi_qr_image_url && (
              <div className="flex justify-center">
                <img
                  src={provider.upi_qr_image_url}
                  alt="UPI QR"
                  className="h-48 w-48 rounded-xl border object-contain"
                />
              </div>
            )}

            {provider?.upi_id && (
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">UPI ID</p>
                  <p className="text-sm font-mono font-semibold">{provider.upi_id}</p>
                </div>
                <Button size="sm" variant="outline" onClick={copyUPI}>
                  <Copy size={14} className="mr-1" /> Copy
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label>UPI Transaction Reference</Label>
              <Input
                value={upiRef}
                onChange={(e) => setUpiRef(e.target.value)}
                placeholder="12-digit UPI reference number"
                className="h-11 rounded-xl"
              />
            </div>

            <Button
              onClick={handleRecordPayment}
              disabled={!upiRef.trim() || recordPayment.isPending}
              className="w-full h-12 bg-primary text-white font-semibold rounded-xl"
            >
              {recordPayment.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                "I've Made the Payment"
              )}
            </Button>

            <button
              onClick={() => { setStep(3); toast.info("You can pay later from My Classes"); }}
              className="w-full text-center text-sm text-muted-foreground"
            >
              Pay Later
            </button>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="flex flex-col items-center gap-4 py-12 text-center animate-fade-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            {waitlistPosition ? (
              <>
                <h2 className="text-xl font-bold">Added to Waitlist</h2>
                <p className="text-sm text-muted-foreground">
                  You're #{waitlistPosition} on the waitlist. We'll notify you when a spot opens.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">Enrolled!</h2>
                <p className="text-sm text-muted-foreground">
                  {batch.registration_mode === "manual"
                    ? "Your enrollment is pending approval from the provider."
                    : "Your provider will confirm the payment shortly."}
                </p>
              </>
            )}
            <div className="flex gap-3 mt-4">
              <Button variant="outline" onClick={() => navigate("/my-classes")}>
                My Classes
              </Button>
              <Button onClick={() => navigate("/home")} className="bg-primary text-white">
                Go Home
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnrollFlow;
