import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useEnrollmentDetail,
  useEnrollmentAttendance,
  useEnrollmentPayments,
  useEnrollmentMaterials,
} from "@/hooks/useSeeker";
import { useBatches } from "@/hooks/useClasses";
import {
  useLearnerDropEnrollment,
  useLearnerRequestBatchSwitch,
  useLearnerCancelBatchSwitch,
} from "@/hooks/useEngagement";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRightLeft,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  UserMinus,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEE_LABELS: Record<string, string> = {
  per_session: "/session",
  monthly: "/month",
  quarterly: "/quarter",
  for_duration: " total",
  one_time: "",
};

const ATTENDANCE_COLORS: Record<string, string> = {
  present: "bg-green-500",
  absent: "bg-red-500",
  late: "bg-amber-500",
  excused: "bg-gray-400",
};

const PAYMENT_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  recorded: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  disputed: "bg-red-100 text-red-700",
};

const EnrollmentDetail = () => {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();

  const { data: enrollment, isLoading } = useEnrollmentDetail(enrollmentId);
  const { data: attendance } = useEnrollmentAttendance(enrollmentId);
  const { data: payments } = useEnrollmentPayments(enrollmentId);

  const batch = enrollment?.batches as any;
  const cls = batch?.classes;
  const classId = cls?.id;
  const batchId = batch?.id;
  const { data: materials } = useEnrollmentMaterials(classId, batchId);

  // Drop / switch state + mutations
  const dropMutation = useLearnerDropEnrollment();
  const requestSwitch = useLearnerRequestBatchSwitch();
  const cancelSwitch = useLearnerCancelBatchSwitch();

  const [dropOpen, setDropOpen] = useState(false);
  const [switchSheetOpen, setSwitchSheetOpen] = useState(false);
  const [selectedTargetBatchId, setSelectedTargetBatchId] = useState<string | null>(null);
  const [switchReason, setSwitchReason] = useState("");
  const [cancelSwitchOpen, setCancelSwitchOpen] = useState(false);

  // Load class batches only when the switch sheet is open
  const { data: classBatches, isLoading: batchesLoading } = useBatches(
    switchSheetOpen ? classId : undefined,
  );

  const pendingSwitchToId = (enrollment as any)?.pending_switch_to_batch_id as string | null;
  const pendingSwitchToBatch = pendingSwitchToId
    ? (classBatches ?? []).find((b: any) => b.id === pendingSwitchToId)
    : null;

  const handleDrop = async () => {
    if (!enrollmentId) return;
    try {
      await dropMutation.mutateAsync(enrollmentId);
      toast.success("You've dropped out of this class");
      setDropOpen(false);
      navigate("/my-classes", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to drop out");
    }
  };

  const handleSubmitSwitch = async () => {
    if (!enrollmentId || !selectedTargetBatchId) return;
    try {
      await requestSwitch.mutateAsync({
        enrollmentId,
        toBatchId: selectedTargetBatchId,
        reason: switchReason.trim() || undefined,
      });
      toast.success("Switch request sent to instructor");
      setSwitchSheetOpen(false);
      setSelectedTargetBatchId(null);
      setSwitchReason("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to request switch");
    }
  };

  const handleCancelSwitch = async () => {
    if (!enrollmentId) return;
    try {
      await cancelSwitch.mutateAsync(enrollmentId);
      toast.success("Switch request cancelled");
      setCancelSwitchOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to cancel");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
          <Skeleton className="h-6 w-40" />
        </header>
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!enrollment || !batch) return null;

  const provider = cls?.provider_apartment_registrations?.service_providers;
  const providerUser = provider?.users;
  const member = enrollment.family_members as any;
  const schedules = batch.batch_schedules ?? [];

  // Attendance stats
  const totalAttendance = attendance?.length ?? 0;
  const presentCount = attendance?.filter((a) => a.status === "present" || a.status === "late").length ?? 0;
  const absentCount = attendance?.filter((a) => a.status === "absent").length ?? 0;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  return (
    <div className="seeker-theme flex min-h-screen flex-col bg-background">
      {/* Gradient header */}
      <div
        className="relative px-4 pt-12 pb-5"
        style={{ background: "linear-gradient(160deg, oklch(0.78 0.18 250) 0%, oklch(0.62 0.20 250) 100%)" }}
      >
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="mt-2">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-lg font-bold text-white leading-tight">{cls?.title}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 shrink-0 ${enrollment.status === "active" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {enrollment.status}
            </span>
          </div>
          <p className="text-white/80 text-sm mt-0.5">{batch.batch_name}</p>
          {member && (
            <p className="text-white/70 text-xs mt-1">
              {member.full_name ?? member.name} · {member.relationship}
            </p>
          )}
        </div>

        {/* Quick stats strip */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 rounded-xl bg-white/20 backdrop-blur-sm p-2.5 text-center">
            <p className="text-lg font-bold text-white">{attendanceRate}%</p>
            <p className="text-[10px] text-white/70">Attendance</p>
          </div>
          <div className="flex-1 rounded-xl bg-white/20 backdrop-blur-sm p-2.5 text-center">
            <p className="text-lg font-bold text-white">{presentCount}</p>
            <p className="text-[10px] text-white/70">Present</p>
          </div>
          <div className="flex-1 rounded-xl bg-white/20 backdrop-blur-sm p-2.5 text-center">
            <p className="text-lg font-bold text-white">{absentCount}</p>
            <p className="text-[10px] text-white/70">Absent</p>
          </div>
          <div className="flex-1 rounded-xl bg-white/20 backdrop-blur-sm p-2.5 text-center">
            <p className="text-lg font-bold text-white">₹{batch.fee_amount}</p>
            <p className="text-[10px] text-white/70">Fee</p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        {/* Pending switch banner */}
        {pendingSwitchToId && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <ArrowRightLeft size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                Switch request pending
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Waiting for the instructor to approve your move to
                {pendingSwitchToBatch ? ` "${pendingSwitchToBatch.batch_name}"` : " another batch"}.
              </p>
            </div>
            <button
              onClick={() => setCancelSwitchOpen(true)}
              className="text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Quick actions grid */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate(`/chat?with=${cls?.service_providers?.user_id ?? cls?.provider_apartment_registrations?.service_providers?.user_id}`)}
            className="flex items-center gap-2 rounded-xl p-3 text-left transition-all active:scale-95"
            style={{ backgroundColor: "oklch(0.96 0.04 250)" }}
          >
            <MessageCircle size={16} style={{ color: "oklch(0.55 0.20 250)" }} />
            <span className="text-xs font-semibold" style={{ color: "oklch(0.38 0.16 250)" }}>Message Provider</span>
          </button>
          <button
            onClick={() => navigate(`/enroll/${batch.id}`)}
            className="flex items-center gap-2 rounded-xl p-3 text-left transition-all active:scale-95"
            style={{ backgroundColor: "oklch(0.96 0.04 250)" }}
          >
            <CreditCard size={16} style={{ color: "oklch(0.55 0.20 250)" }} />
            <span className="text-xs font-semibold" style={{ color: "oklch(0.38 0.16 250)" }}>Record Payment</span>
          </button>
        </div>

        {/* Switch / Drop — only for active or pending enrollments */}
        {(enrollment.status === "active" || enrollment.status === "pending") && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSwitchSheetOpen(true)}
              disabled={!!pendingSwitchToId}
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              title={pendingSwitchToId ? "A switch request is already pending" : undefined}
            >
              <ArrowRightLeft size={14} /> Switch Batch
            </button>
            <button
              onClick={() => setDropOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 transition-all active:scale-95"
            >
              <UserMinus size={14} /> Drop Out
            </button>
          </div>
        )}

        <Tabs defaultValue="schedule">
          <TabsList className="w-full">
            <TabsTrigger value="schedule" className="flex-1 text-xs">Schedule</TabsTrigger>
            <TabsTrigger value="attendance" className="flex-1 text-xs">Attendance</TabsTrigger>
            <TabsTrigger value="payments" className="flex-1 text-xs">Payments</TabsTrigger>
            <TabsTrigger value="materials" className="flex-1 text-xs">Materials</TabsTrigger>
          </TabsList>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="mt-4 space-y-3">
            <h3 className="text-sm font-bold">Weekly Schedule</h3>
            {schedules.length > 0 ? (
              <div className="space-y-2">
                {schedules.map((s: any, i: number) => (
                  <Card key={i} className="flex items-center gap-3 p-3" style={{ borderColor: "oklch(0.62 0.20 250 / 0.2)" }}>
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))" }}
                    >
                      <span className="text-xs font-bold text-white">{DAY_NAMES[s.day_of_week]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{DAY_NAMES[s.day_of_week]}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No schedule set</p>
            )}
            {(batch.trainers as any)?.name && (
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <span className="text-xs text-muted-foreground">Trainer:</span>
                <span className="text-xs font-medium">{(batch.trainers as any).name}</span>
              </div>
            )}
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="mt-4 space-y-4">
            {/* Attendance list */}
            {attendance && attendance.length > 0 ? (
              <div className="space-y-1.5">
                {attendance.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${ATTENDANCE_COLORS[record.status ?? ""] ?? "bg-gray-300"}`} />
                      <span className="text-sm">
                        {new Date(record.session_date).toLocaleDateString("en-IN", {
                          weekday: "short", day: "numeric", month: "short",
                        })}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] capitalize">{record.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Calendar size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No attendance records yet</p>
              </div>
            )}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="mt-4 space-y-3">
            {payments && payments.length > 0 ? (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <Card key={payment.id} className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">₹{payment.amount}</span>
                      <Badge className={`text-[10px] border-0 ${PAYMENT_COLORS[payment.status ?? ""] ?? "bg-gray-100"}`}>
                        {payment.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {payment.paid_at && (
                        <span>
                          {new Date(payment.paid_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                      )}
                      {payment.payment_period_start && payment.payment_period_end && (
                        <span className="text-[10px]">
                          Period: {payment.payment_period_start} – {payment.payment_period_end}
                        </span>
                      )}
                    </div>
                    {payment.upi_transaction_id && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Ref: {payment.upi_transaction_id}
                      </p>
                    )}
                    {payment.status === "confirmed" && (
                      <div className="flex items-center gap-1 text-[10px] text-green-600">
                        <CheckCircle size={10} /> Confirmed
                        {payment.confirmed_at && ` on ${new Date(payment.confirmed_at).toLocaleDateString("en-IN")}`}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <CreditCard size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No payments recorded yet</p>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full border-primary text-primary"
              onClick={() => navigate(`/enroll/${batch.id}`)}
            >
              <CreditCard size={14} className="mr-1" /> Pay Now
            </Button>
          </TabsContent>

          {/* Materials Tab */}
          <TabsContent value="materials" className="mt-4 space-y-3">
            {materials && materials.length > 0 ? (
              <div className="space-y-2">
                {materials.map((mat) => (
                  <Card
                    key={mat.id}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:shadow-sm"
                    onClick={() => {
                      if (mat.file_url) window.open(mat.file_url, "_blank");
                      else if (mat.external_url) window.open(mat.external_url, "_blank");
                    }}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      {mat.material_type === "document" ? (
                        <FileText size={16} className="text-primary" />
                      ) : mat.material_type === "video" ? (
                        <BookOpen size={16} className="text-primary" />
                      ) : (
                        <FileText size={16} className="text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mat.title}</p>
                      {mat.description && (
                        <p className="text-xs text-muted-foreground truncate">{mat.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {mat.material_type} · {new Date(mat.created_at).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <FileText size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No materials shared yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Drop confirmation */}
      <AlertDialog open={dropOpen} onOpenChange={setDropOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop out of {cls?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll no longer be enrolled in this batch. The instructor will be
              notified. Past attendance and payment records are preserved. Any
              pending batch switch on this enrollment will also be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={dropMutation.isPending}
            >
              {dropMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Drop out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel-switch confirmation */}
      <AlertDialog open={cancelSwitchOpen} onOpenChange={setCancelSwitchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel switch request?</AlertDialogTitle>
            <AlertDialogDescription>
              Your pending request to switch batches will be withdrawn. You can
              request a different switch later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep request</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSwitch}
              disabled={cancelSwitch.isPending}
            >
              {cancelSwitch.isPending ? <Loader2 size={14} className="animate-spin" /> : "Cancel request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Switch-batch picker */}
      <Sheet
        open={switchSheetOpen}
        onOpenChange={(open) => {
          setSwitchSheetOpen(open);
          if (!open) {
            setSelectedTargetBatchId(null);
            setSwitchReason("");
          }
        }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle>Switch to another batch</SheetTitle>
          </SheetHeader>
          <p className="text-xs text-muted-foreground mb-3">
            Pick a different batch of {cls?.title}. The instructor will get a
            request — you'll be moved once they approve.
          </p>

          {batchesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (() => {
            const candidates = (classBatches ?? []).filter(
              (b: any) =>
                b.id !== batchId &&
                (b.status === "active" || b.status === "full"),
            );
            if (candidates.length === 0) {
              return (
                <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                  No other batches available for this class right now.
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {candidates.map((b: any) => {
                  const isFull = b.status === "full" || b.current_enrollment_count >= b.max_batch_size;
                  const selected = selectedTargetBatchId === b.id;
                  const days = (b.batch_schedules ?? [])
                    .map((s: any) => DAY_NAMES[s.day_of_week])
                    .join(", ");
                  const t0 = b.batch_schedules?.[0];
                  const time = t0
                    ? `${t0.start_time?.slice(0, 5)} – ${t0.end_time?.slice(0, 5)}`
                    : "";
                  return (
                    <button
                      key={b.id}
                      onClick={() => !isFull && setSelectedTargetBatchId(b.id)}
                      disabled={isFull}
                      className={`w-full rounded-xl border p-3 text-left transition-all ${
                        selected ? "border-primary bg-primary/5" : "border-border"
                      } ${isFull ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{b.batch_name}</p>
                          {(b.trainers as any)?.name && (
                            <p className="text-[11px] text-muted-foreground">
                              Trainer: {(b.trainers as any).name}
                            </p>
                          )}
                        </div>
                        {isFull ? (
                          <Badge className="text-[9px] border-0 bg-red-100 text-red-700">Full</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]">
                            {b.current_enrollment_count}/{b.max_batch_size}
                          </Badge>
                        )}
                      </div>
                      {(days || time) && (
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          {days && <span className="flex items-center gap-1"><Calendar size={10} />{days}</span>}
                          {time && <span className="flex items-center gap-1"><Clock size={10} />{time}</span>}
                        </div>
                      )}
                      <p className="mt-1 text-[11px] font-semibold text-primary">
                        ₹{b.fee_amount}{FEE_LABELS[b.fee_frequency] ?? ""}
                      </p>
                    </button>
                  );
                })}

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-medium">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Textarea
                    rows={2}
                    value={switchReason}
                    onChange={(e) => setSwitchReason(e.target.value)}
                    placeholder="e.g. Schedule no longer works, prefer the new trainer…"
                    className="text-xs rounded-lg"
                  />
                </div>

                <Button
                  onClick={handleSubmitSwitch}
                  disabled={!selectedTargetBatchId || requestSwitch.isPending}
                  className="w-full"
                >
                  {requestSwitch.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    "Request switch"
                  )}
                </Button>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default EnrollmentDetail;
