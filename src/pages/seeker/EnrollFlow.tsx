import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useCreateEnrollment, useCreateWaitlistEntry, useRecordPayment } from "@/hooks/useSeeker";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, CheckCircle, Clock, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEE_LABELS: Record<string, string> = {
  per_session: "/session",
  monthly: "/month",
  quarterly: "/quarter",
  for_duration: " total",
  one_time: "",
};

const STEP_LABELS = ["Child", "Plan", "Payment", "Done"];

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

  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: ["enroll-batch", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select(`
          id, batch_name, skill_level, fee_amount, fee_frequency, registration_fee, status,
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

  const cls = (batch?.classes as any) ?? null;
  const provider = cls?.provider_apartment_registrations?.service_providers ?? null;
  const schedules = batch?.batch_schedules ?? [];
  const addons = useMemo(
    () => (cls?.class_addons ?? []).filter((a: any) => a.is_active),
    [cls]
  );
  const slotsLeft = batch ? batch.max_batch_size - (batch.current_enrollment_count ?? 0) : 0;
  const isFull = batch ? (batch.status === "full" || slotsLeft <= 0) : false;
  const registrationFee = (batch as any)?.registration_fee ?? 0;

  useEffect(() => {
    if (!addons.length) return;
    const mandatoryIds = addons.filter((a: any) => a.is_mandatory).map((a: any) => a.id);
    if (mandatoryIds.length > 0) {
      setSelectedAddonIds((prev) => {
        const merged = [...new Set([...prev, ...mandatoryIds])];
        return merged.length !== prev.length ? merged : prev;
      });
    }
  }, [addons]);

  const { data: existingEnrollment } = useQuery({
    queryKey: ["existing-enrollment-check", selectedMemberId, cls?.id],
    enabled: !!selectedMemberId && !!cls?.id,
    queryFn: async () => {
      const { data: classBatches } = await supabase
        .from("batches")
        .select("id")
        .eq("class_id", cls.id);
      if (!classBatches?.length) return null;
      const batchIds = classBatches.map((b: any) => b.id);
      const { data } = await supabase
        .from("enrollments")
        .select("id")
        .in("batch_id", batchIds)
        .eq("family_member_id", selectedMemberId)
        .in("status", ["active", "completed", "paused"])
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const isFirstTimeEnrollment = !existingEnrollment;
  const applicableRegFee = isFirstTimeEnrollment ? registrationFee : 0;

  const mandatoryIds = useMemo(
    () => addons.filter((a: any) => a.is_mandatory).map((a: any) => a.id),
    [addons]
  );

  const toggleAddon = (id: string) => {
    if (mandatoryIds.includes(id)) return;
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedAddons = addons.filter((a: any) => selectedAddonIds.includes(a.id));
  const addonTotal = selectedAddons.reduce((sum: number, a: any) => sum + a.fee_amount, 0);
  const totalAmount = (batch?.fee_amount ?? 0) + addonTotal + applicableRegFee;

  const handleEnroll = async () => {
    if (!selectedMemberId || !profile || !batch) return;
    try {
      if (isFull && batch.auto_waitlist) {
        const result = await createWaitlist.mutateAsync({
          batchId: batch.id,
          familyMemberId: selectedMemberId,
          requestedBy: profile.id,
        });
        setWaitlistPosition(result.position);
        setStep(3);
        return;
      }
      const result = await createEnrollment.mutateAsync({
        batchId: batch.id,
        familyMemberId: selectedMemberId,
        enrolledBy: profile.id,
        selectedAddonIds,
      });
      setEnrollmentId(result.id);
      setStep(2);
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
      setStep(3);
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

  if (batchLoading || !profile) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="gradient-primary h-36 px-4 pt-12 flex items-start">
          <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <ArrowLeft size={18} className="text-white" />
          </button>
        </div>
        <div className="px-4 pt-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-bold">Enroll</h1>
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Batch not found</p>
        </div>
      </div>
    );
  }

  const scheduleSummary = schedules.map((s: any) => DAY_NAMES[s.day_of_week]).join(", ");
  const timeSummary = schedules[0]
    ? `${schedules[0].start_time.slice(0, 5)}–${schedules[0].end_time.slice(0, 5)}`
    : "";
  const selectedMember = familyMembers.find((m) => m.id === selectedMemberId);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-8">
      {/* Hero header */}
      <div className="gradient-primary px-4 pb-6 pt-12">
        <button
          onClick={() => step > 0 && step < 3 ? setStep(step - 1) : navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 mb-4"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-0.5">
          {cls?.title}
        </p>
        <h1 className="text-white text-lg font-bold leading-snug">{batch.batch_name}</h1>
        {scheduleSummary && (
          <p className="text-white/70 text-xs mt-1 flex items-center gap-1.5">
            <Calendar size={11} />
            {scheduleSummary}
            {timeSummary && <> · <Clock size={11} /> {timeSummary}</>}
          </p>
        )}
      </div>

      {/* Step tabs */}
      {step < 3 && (
        <div className="bg-card border-b border-border">
          <div className="mx-auto max-w-lg flex">
            {STEP_LABELS.slice(0, 3).map((label, i) => (
              <div
                key={i}
                className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  i === step
                    ? "border-primary text-primary"
                    : i < step
                    ? "border-primary/40 text-primary/60"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {i + 1}. {label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-lg px-4 py-5 space-y-4">
        {/* Step 0: Select family member */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Who is enrolling?</h2>
            {familyMembers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">No family members found.</p>
                <Button variant="outline" className="mt-3 rounded-xl" onClick={() => navigate("/family")}>
                  Add Family Member
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {familyMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMemberId(member.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                      selectedMemberId === member.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {member.full_name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {member.relationship}
                        {(member as any).age_group && ` · ${(member as any).age_group}`}
                      </p>
                    </div>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedMemberId === member.id ? "border-primary bg-primary" : "border-border"
                    }`}>
                      {selectedMemberId === member.id && (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <Button
              disabled={!selectedMemberId}
              onClick={() => setStep(1)}
              className="w-full h-12 gradient-primary text-white font-semibold rounded-xl"
            >
              Continue →
            </Button>
          </div>
        )}

        {/* Step 1: Review & plan */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Review your plan</h2>

            {/* Enrolling for */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Enrolling</p>
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {selectedMember?.full_name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{selectedMember?.full_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedMember?.relationship}</p>
                </div>
              </div>
            </div>

            {/* Plan card */}
            <div className={`rounded-2xl border-2 border-primary bg-primary/5 p-4 relative`}>
              <div className="absolute -top-2.5 left-4">
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  {batch.fee_frequency === "monthly" ? "Monthly" :
                   batch.fee_frequency === "quarterly" ? "Quarterly · Save more" :
                   batch.fee_frequency === "per_session" ? "Per Session" : "Plan"}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div>
                  <p className="text-sm font-semibold">{batch.batch_name}</p>
                  {batch.skill_level && (
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{batch.skill_level.replace("_", " ")}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">₹{batch.fee_amount}</p>
                  <p className="text-xs text-muted-foreground">{FEE_LABELS[batch.fee_frequency] ?? ""}</p>
                </div>
              </div>
              {scheduleSummary && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <span className="flex items-center gap-1"><Calendar size={11} /> {scheduleSummary}</span>
                  {timeSummary && <span className="flex items-center gap-1"><Clock size={11} /> {timeSummary}</span>}
                </div>
              )}
            </div>

            {/* Addons */}
            {addons.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold">Add-ons</p>
                {addons.map((addon: any) => (
                  <button
                    key={addon.id}
                    onClick={() => toggleAddon(addon.id)}
                    disabled={addon.is_mandatory}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      selectedAddonIds.includes(addon.id)
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    } ${addon.is_mandatory ? "opacity-80" : ""}`}
                  >
                    <Checkbox
                      checked={selectedAddonIds.includes(addon.id)}
                      onCheckedChange={() => toggleAddon(addon.id)}
                      disabled={addon.is_mandatory}
                      className="pointer-events-none"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{addon.name}</p>
                      {addon.description && (
                        <p className="text-xs text-muted-foreground">{addon.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">₹{addon.fee_amount}</p>
                      {addon.is_mandatory && (
                        <p className="text-[10px] text-destructive font-semibold">Required</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Cost breakdown */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Cost Summary</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base fee</span>
                <span className="font-semibold">₹{batch.fee_amount}{FEE_LABELS[batch.fee_frequency] ?? ""}</span>
              </div>
              {applicableRegFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Registration <span className="text-[10px]">(one-time)</span></span>
                  <span className="font-semibold">₹{applicableRegFee}</span>
                </div>
              )}
              {selectedAddons.map((a: any) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{a.name}</span>
                  <span className="font-semibold">₹{a.fee_amount}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold pt-2 border-t border-border">
                <span>Total</span>
                <span className="text-primary text-base">₹{totalAmount}</span>
              </div>
            </div>

            {isFull && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-700 font-medium">
                  This batch is full. You'll be added to the waitlist.
                </p>
              </div>
            )}

            <Button
              onClick={handleEnroll}
              disabled={createEnrollment.isPending || createWaitlist.isPending}
              className="w-full h-12 gradient-primary text-white font-semibold rounded-xl"
            >
              {createEnrollment.isPending || createWaitlist.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : isFull ? (
                "Join Waitlist"
              ) : (
                "Confirm & Pay →"
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Payment */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Make Payment</h2>

            <div className="rounded-2xl gradient-primary p-5 text-center">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Amount Due</p>
              <p className="text-4xl font-bold text-white">₹{totalAmount}</p>
              <p className="text-white/60 text-xs mt-1">Pay via UPI to provider</p>
            </div>

            {provider?.upi_qr_image_url && (
              <div className="flex justify-center">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <img
                    src={provider.upi_qr_image_url}
                    alt="UPI QR"
                    className="h-48 w-48 object-contain"
                  />
                </div>
              </div>
            )}

            {provider?.upi_id && (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">UPI ID</p>
                  <p className="text-sm font-mono font-semibold mt-0.5">{provider.upi_id}</p>
                </div>
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={copyUPI}>
                  <Copy size={13} /> Copy
                </Button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                UPI Transaction Reference
              </Label>
              <Input
                value={upiRef}
                onChange={(e) => setUpiRef(e.target.value)}
                placeholder="12-digit UPI reference number"
                className="h-12 rounded-xl"
              />
            </div>

            <Button
              onClick={handleRecordPayment}
              disabled={!upiRef.trim() || recordPayment.isPending}
              className="w-full h-12 gradient-primary text-white font-semibold rounded-xl"
            >
              {recordPayment.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                "I've Made the Payment →"
              )}
            </Button>

            <button
              onClick={() => { setStep(3); toast.info("You can pay later from My Classes"); }}
              className="w-full text-center text-sm text-muted-foreground py-1"
            >
              Skip — Pay Later
            </button>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle size={36} className="text-green-600" />
            </div>
            {waitlistPosition ? (
              <>
                <h2 className="text-xl font-bold">Added to Waitlist!</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  You're #{waitlistPosition} on the waitlist. We'll notify you when a spot opens.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">You're Enrolled!</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {batch.registration_mode === "manual"
                    ? "Your enrollment is pending approval from the provider."
                    : "Your provider will confirm the payment shortly."}
                </p>
              </>
            )}
            <div className="flex gap-3 mt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => navigate("/my-classes")}>
                My Classes
              </Button>
              <Button
                className="gradient-primary text-white rounded-xl"
                onClick={() => navigate("/home")}
              >
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
