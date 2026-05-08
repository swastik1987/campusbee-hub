import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useCreateEnrollment, useCreateWaitlistEntry, useRecordPayment } from "@/hooks/useSeeker";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, CheckCircle, Clock, Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEE_LABELS: Record<string, string> = {
  per_session: "/session",
  monthly: "/month",
  quarterly: "/quarter",
  for_duration: " total",
  one_time: "",
};

const STEP_LABELS = ["Member", "Review", "Payment"];

const EnrollFlow = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { profile, family, familyMembers, refreshFamily } = useUser();

  const [step, setStep] = useState(0);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [upiRef, setUpiRef] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);

  const createEnrollment = useCreateEnrollment();
  const createWaitlist = useCreateWaitlistEntry();
  const recordPayment = useRecordPayment();

  // Lazy ensure: existing users who completed onboarding before migration 026
  // won't have a self member row yet — create it silently on mount.
  useEffect(() => {
    if (!family || !profile) return;
    const hasSelf = familyMembers.some((m) => m.relationship === "self");
    if (hasSelf) return;

    supabase
      .rpc("ensure_self_family_member", {
        p_family_id: family.id,
        p_full_name: profile.full_name,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[EnrollFlow] ensure_self_family_member failed:", error);
        } else {
          refreshFamily();
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id, profile?.id]);

  // Split members: "self" row pinned first, everyone else below.
  const selfMember = familyMembers.find((m) => m.relationship === "self");
  const otherMembers = familyMembers.filter((m) => m.relationship !== "self");

  // Fetch batch details with class info
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
            service_providers(id, business_name, upi_id, upi_qr_image_url, whatsapp_number,
              users(full_name)
            )
          )
        `)
        .eq("id", batchId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Derived data — safe even when batch is null
  const cls = (batch?.classes as any) ?? null;
  const provider = cls?.service_providers ?? null;
  const schedules = batch?.batch_schedules ?? [];
  const addons = useMemo(
    () => (cls?.class_addons ?? []).filter((a: any) => a.is_active),
    [cls]
  );
  const slotsLeft = batch ? batch.max_batch_size - (batch.current_enrollment_count ?? 0) : 0;
  const isFull = batch ? (batch.status === "full" || slotsLeft <= 0) : false;
  const registrationFee = (batch as any)?.registration_fee ?? 0;

  // Initialize mandatory addons via useEffect (not during render)
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

  // Check if this member already has an enrollment in any batch of this class (registration fee is first-time only)
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

  // Name of the selected member (for review step)
  const selectedMemberName =
    selectedMemberId === selfMember?.id
      ? profile?.full_name
      : familyMembers.find((m) => m.id === selectedMemberId)?.full_name;

  // ─── Loading state ────────────────────────────────────────────────────────
  if (batchLoading || !profile) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
          <Skeleton className="h-6 w-32" />
        </header>
        <div className="p-6 space-y-4">
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

  // ─── Step 3: Full-screen success (no header or progress bar) ─────────────
  if (step === 3) {
    return (
      <div className="seeker-theme flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-12 text-center animate-fade-up">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: "linear-gradient(135deg, #d1fae5, #a7f3d0)" }}
        >
          <CheckCircle size={40} className="text-green-600" />
        </div>

        {waitlistPosition ? (
          <>
            <div>
              <h2 className="text-2xl font-bold">Added to Waitlist</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                You're <span className="font-semibold text-foreground">#{waitlistPosition}</span> on the waitlist.
                We'll notify you when a spot opens up!
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-bold">You're enrolled! 🎉</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {batch.registration_mode === "manual"
                  ? "Your enrollment is pending approval from the provider."
                  : "Your provider will confirm the payment shortly."}
              </p>
            </div>
          </>
        )}

        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => navigate("/my-classes")}
            className="w-full h-12 rounded-xl border-2 border-border bg-card font-semibold text-sm transition-all active:scale-95"
          >
            View My Classes
          </button>
          <button
            onClick={() => navigate("/explore")}
            className="w-full h-12 rounded-xl text-white font-semibold text-sm transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))" }}
          >
            Explore More Classes
          </button>
        </div>
      </div>
    );
  }

  // ─── Steps 0–2 ───────────────────────────────────────────────────────────
  return (
    <div className="seeker-theme flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => (step > 0 ? setStep(step - 1) : navigate(-1))}
          className="p-1"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">
          {step === 0 ? "Select Member" : step === 1 ? "Review" : "Payment"}
        </h1>
      </header>

      {/* Stepper progress bar */}
      <div className="px-6 pt-4 pb-3">
        <div className="flex gap-2">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex-1 space-y-1.5">
              <div
                className="h-1.5 w-full rounded-full overflow-hidden"
                style={{
                  background:
                    i <= step
                      ? "linear-gradient(90deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))"
                      : "hsl(var(--muted))",
                }}
              />
              <p
                className={`text-[10px] text-center font-medium ${
                  i <= step ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg px-6 py-4 space-y-5">
        {/* ── Step 0: Select family member ── */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="text-xl font-bold">Who is enrolling?</h2>

            {/* Self member pinned at top */}
            {selfMember && (
              <Card
                className={`flex items-center gap-3 p-4 cursor-pointer transition-all ${
                  selectedMemberId === selfMember.id
                    ? "border-2 bg-primary/5"
                    : "hover:border-primary/40"
                }`}
                style={
                  selectedMemberId === selfMember.id
                    ? { borderColor: "oklch(0.62 0.20 250)" }
                    : undefined
                }
                onClick={() => setSelectedMemberId(selfMember.id)}
              >
                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/15 text-primary font-bold text-xs">
                    {profile.full_name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{profile.full_name}</p>
                    <span className="flex-shrink-0 text-[10px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                      You
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Myself</p>
                </div>
                {selectedMemberId === selfMember.id && (
                  <CheckCircle size={20} className="text-primary flex-shrink-0" />
                )}
              </Card>
            )}

            {/* Divider before other members */}
            {otherMembers.length > 0 && (
              <p className="text-xs font-semibold text-muted-foreground px-1 pt-1">
                Family members
              </p>
            )}

            {/* Other family members */}
            {otherMembers.map((member) => (
              <Card
                key={member.id}
                className={`flex items-center gap-3 p-4 cursor-pointer transition-all ${
                  selectedMemberId === member.id
                    ? "border-2"
                    : "hover:border-primary/50"
                }`}
                style={
                  selectedMemberId === member.id
                    ? { borderColor: "oklch(0.62 0.20 250)", backgroundColor: "oklch(0.96 0.04 250)" }
                    : undefined
                }
                onClick={() => setSelectedMemberId(member.id)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {member.full_name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {member.relationship}
                    {member.age_group && ` · ${member.age_group}`}
                  </p>
                </div>
                {selectedMemberId === member.id && (
                  <CheckCircle size={20} className="text-primary flex-shrink-0" />
                )}
              </Card>
            ))}

            {/* Empty state: no self member yet (lazy creation in progress) */}
            {!selfMember && otherMembers.length === 0 && (
              <Card className="p-5 text-center">
                <Loader2 size={20} className="animate-spin mx-auto text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Setting up your account…</p>
              </Card>
            )}

            {/* "Add family member" CTA */}
            <button
              type="button"
              onClick={() => navigate("/family")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <UserPlus size={16} />
              Enrolling for someone else? Add a family member
            </button>

            <button
              disabled={!selectedMemberId}
              onClick={() => setStep(1)}
              className="w-full h-12 rounded-xl text-white font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))" }}
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Step 1: Review batch + addons ── */}
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

            <Card className="p-4 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Enrolling</p>
              <p className="text-sm font-semibold">{selectedMemberName}</p>
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
                      {addon.description && (
                        <p className="text-xs text-muted-foreground">{addon.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">₹{addon.fee_amount}</p>
                      {addon.is_mandatory && (
                        <p className="text-[9px] text-destructive">Required</p>
                      )}
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
              {applicableRegFee > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    Registration fee{" "}
                    <span className="text-[10px]">(one-time)</span>
                  </span>
                  <span>₹{applicableRegFee}</span>
                </div>
              )}
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

            <button
              onClick={handleEnroll}
              disabled={createEnrollment.isPending || createWaitlist.isPending}
              className="w-full h-12 rounded-xl text-white font-semibold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))" }}
            >
              {createEnrollment.isPending || createWaitlist.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : isFull ? (
                "Join Waitlist"
              ) : (
                "Confirm & Pay"
              )}
            </button>
          </div>
        )}

        {/* ── Step 2: Payment ── */}
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

            <button
              onClick={handleRecordPayment}
              disabled={!upiRef.trim() || recordPayment.isPending}
              className="w-full h-12 rounded-xl text-white font-semibold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))" }}
            >
              {recordPayment.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                "I've Made the Payment"
              )}
            </button>

            <button
              onClick={() => {
                setStep(3);
                toast.info("You can pay later from My Classes");
              }}
              className="w-full text-center text-sm text-muted-foreground"
            >
              Pay Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnrollFlow;
