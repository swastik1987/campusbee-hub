import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useEnrollmentDetail,
  useEnrollmentAttendance,
  useEnrollmentPayments,
  useEnrollmentMaterials,
} from "@/hooks/useSeeker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  MapPin,
  MessageCircle,
  XCircle,
} from "lucide-react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEE_LABELS: Record<string, string> = {
  per_session: "/session",
  monthly: "/month",
  quarterly: "/quarter",
  for_duration: " total",
  one_time: "",
};

const ATTENDANCE_COLORS: Record<string, { dot: string; text: string; label: string }> = {
  present: { dot: "bg-green-500", text: "text-green-600", label: "Present" },
  absent:  { dot: "bg-red-500",   text: "text-red-600",   label: "Absent"  },
  late:    { dot: "bg-amber-500", text: "text-amber-600", label: "Late"    },
  excused: { dot: "bg-gray-400",  text: "text-gray-500",  label: "Excused" },
};

const PAYMENT_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  recorded:  "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  disputed:  "bg-red-100 text-red-700",
};

type TabId = "schedule" | "attendance" | "payments" | "materials";

/** Circular SVG progress ring */
const AttendanceRing = ({ rate, size = 80 }: { rate: number; size?: number }) => {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (rate / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={rate >= 75 ? "#22c55e" : rate >= 50 ? "#f59e0b" : "#ef4444"}
        strokeWidth={7}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
};

const EnrollmentDetail = () => {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("schedule");

  const { data: enrollment, isLoading } = useEnrollmentDetail(enrollmentId);
  const { data: attendance } = useEnrollmentAttendance(enrollmentId);
  const { data: payments } = useEnrollmentPayments(enrollmentId);

  const batch = enrollment?.batches as any;
  const cls = batch?.classes;
  const classId = cls?.id;
  const batchId = batch?.id;
  const { data: materials } = useEnrollmentMaterials(classId, batchId);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Skeleton className="h-48 w-full" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!enrollment || !batch) return null;

  const provider = cls?.provider_apartment_registrations?.service_providers;
  const member = enrollment.family_members as any;
  const schedules: any[] = batch.batch_schedules ?? [];

  // Attendance stats
  const totalAttendance = attendance?.length ?? 0;
  const presentCount = attendance?.filter((a) => a.status === "present" || a.status === "late").length ?? 0;
  const absentCount  = attendance?.filter((a) => a.status === "absent").length ?? 0;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  // Upcoming session dates (next 7 days based on schedule)
  const upcomingDates: Date[] = [];
  const today = new Date();
  for (let d = 0; d < 14 && upcomingDates.length < 5; d++) {
    const day = new Date(today);
    day.setDate(today.getDate() + d);
    if (schedules.some((s: any) => s.day_of_week === day.getDay())) {
      upcomingDates.push(day);
    }
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    active:    { label: "ACTIVE",    color: "bg-green-400/25 text-green-100" },
    pending:   { label: "PENDING",   color: "bg-amber-400/25 text-amber-100" },
    completed: { label: "COMPLETED", color: "bg-gray-400/25 text-gray-200"  },
    dropped:   { label: "DROPPED",   color: "bg-red-400/25 text-red-200"    },
    paused:    { label: "PAUSED",    color: "bg-gray-400/25 text-gray-200"  },
  };
  const statusCfg = statusConfig[enrollment.status ?? ""] ?? { label: enrollment.status ?? "", color: "bg-gray-400/25 text-gray-200" };

  const feeLabel = `${batch.fee_frequency?.toUpperCase().replace("_", " ") ?? ""}`;

  const tabs: { id: TabId; label: string }[] = [
    { id: "schedule",   label: "Schedule"   },
    { id: "attendance", label: "Attendance" },
    { id: "payments",   label: "Payments"   },
    { id: "materials",  label: "Materials"  },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background pb-8">
      {/* Hero card */}
      <div className="gradient-primary px-4 pb-6 pt-12">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 mb-4"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>

        {/* Status + fee badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
          {feeLabel && (
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              {feeLabel}
            </span>
          )}
        </div>

        <h1 className="text-white text-lg font-bold leading-snug mb-0.5">{cls?.title}</h1>
        <p className="text-white/70 text-xs">
          {provider?.business_name || provider?.users?.full_name || ""}
          {member?.full_name && (
            <> · <span className="font-semibold text-white/90">{member.full_name}</span></>
          )}
        </p>

        {/* Fee */}
        <p className="text-white/90 text-sm font-semibold mt-2">
          ₹{batch.fee_amount}
          <span className="font-normal text-white/60 text-xs">{FEE_LABELS[batch.fee_frequency] ?? ""}</span>
        </p>
      </div>

      {/* Upcoming sessions chip scroller */}
      {upcomingDates.length > 0 && (
        <div className="bg-card border-b border-border px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Upcoming Sessions</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {upcomingDates.map((date, i) => (
              <div
                key={i}
                className={`flex-shrink-0 flex flex-col items-center rounded-xl px-3 py-2 ${
                  i === 0 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                <p className="text-[10px] font-semibold uppercase">{DAY_NAMES[date.getDay()]}</p>
                <p className="text-base font-bold leading-none">{date.getDate()}</p>
                <p className="text-[9px] font-medium">
                  {date.toLocaleDateString("en-IN", { month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick action buttons */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/chat?with=${provider?.user_id}`)}
            className="flex-1 flex flex-col items-center gap-1 rounded-xl bg-muted py-2.5"
          >
            <MessageCircle size={18} className="text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground">Chat</span>
          </button>
          <button
            onClick={() => setActiveTab("materials")}
            className="flex-1 flex flex-col items-center gap-1 rounded-xl bg-muted py-2.5"
          >
            <BookOpen size={18} className="text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground">Materials</span>
          </button>
          <button
            onClick={() => navigate(`/enroll/${batch.id}`)}
            className="flex-1 flex flex-col items-center gap-1 rounded-xl bg-muted py-2.5"
          >
            <CreditCard size={18} className="text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground">Pay</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border">
        <div className="mx-auto max-w-lg flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg px-4 py-5 space-y-4">
        {/* Schedule Tab */}
        {activeTab === "schedule" && (
          <div className="space-y-3">
            <h2 className="text-base font-bold">Weekly Schedule</h2>
            {schedules.length > 0 ? (
              <div className="space-y-2">
                {schedules.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
                    <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                      <span className="text-[10px] font-bold text-primary uppercase">{DAY_NAMES[s.day_of_week]}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{DAY_NAMES[s.day_of_week]}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Clock size={11} />
                        {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center">
                <Calendar size={22} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No schedule set</p>
              </div>
            )}
            {(batch.trainers as any)?.name && (
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {(batch.trainers as any).name[0]}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trainer</p>
                  <p className="text-xs font-semibold">{(batch.trainers as any).name}</p>
                </div>
              </div>
            )}
            {cls?.venue_details && (
              <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3">
                <MapPin size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Venue</p>
                  <p className="text-xs font-medium mt-0.5">{cls.venue_details}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === "attendance" && (
          <div className="space-y-4">
            {/* Circular ring + stats */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-5">
                <div className="relative flex-shrink-0">
                  <AttendanceRing rate={attendanceRate} size={84} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className={`text-lg font-bold ${attendanceRate >= 75 ? "text-green-600" : attendanceRate >= 50 ? "text-amber-600" : "text-red-500"}`}>
                      {attendanceRate}%
                    </p>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-green-50 p-3 text-center">
                    <p className="text-xl font-bold text-green-600">{presentCount}</p>
                    <p className="text-[10px] font-semibold text-green-700">Present</p>
                  </div>
                  <div className="rounded-xl bg-red-50 p-3 text-center">
                    <p className="text-xl font-bold text-red-500">{absentCount}</p>
                    <p className="text-[10px] font-semibold text-red-600">Absent</p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-muted p-2.5 text-center">
                    <p className="text-base font-bold">{totalAttendance}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground">Total Sessions</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance list */}
            {attendance && attendance.length > 0 ? (
              <div className="space-y-2">
                {attendance.map((record) => {
                  const cfg = ATTENDANCE_COLORS[record.status ?? ""] ?? { dot: "bg-gray-300", text: "text-gray-500", label: record.status ?? "" };
                  return (
                    <div key={record.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <p className="text-sm font-medium">
                          {new Date(record.session_date).toLocaleDateString("en-IN", {
                            weekday: "short", day: "numeric", month: "short",
                          })}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center">
                <Calendar size={22} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No attendance records yet</p>
              </div>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Payments</h2>
              <Button
                size="sm"
                className="gradient-primary text-white rounded-xl gap-1.5 text-xs h-8"
                onClick={() => navigate(`/enroll/${batch.id}`)}
              >
                <CreditCard size={13} /> Pay Now
              </Button>
            </div>
            {payments && payments.length > 0 ? (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-base text-primary">₹{payment.amount}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PAYMENT_COLORS[payment.status ?? ""] ?? "bg-gray-100 text-gray-500"}`}>
                        {payment.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {payment.paid_at && (
                        <span>{new Date(payment.paid_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                      {payment.payment_period_start && payment.payment_period_end && (
                        <span>Period: {payment.payment_period_start} – {payment.payment_period_end}</span>
                      )}
                    </div>
                    {payment.upi_transaction_id && (
                      <p className="text-[10px] text-muted-foreground font-mono">Ref: {payment.upi_transaction_id}</p>
                    )}
                    {payment.status === "confirmed" && (
                      <div className="flex items-center gap-1 text-[10px] text-green-600 font-semibold">
                        <CheckCircle size={10} /> Confirmed
                        {payment.confirmed_at && ` · ${new Date(payment.confirmed_at).toLocaleDateString("en-IN")}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border py-10 text-center">
                <CreditCard size={22} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No payments recorded yet</p>
              </div>
            )}
          </div>
        )}

        {/* Materials Tab */}
        {activeTab === "materials" && (
          <div className="space-y-3">
            <h2 className="text-base font-bold">Materials</h2>
            {materials && materials.length > 0 ? (
              <div className="space-y-2">
                {materials.map((mat) => (
                  <button
                    key={mat.id}
                    onClick={() => {
                      if (mat.file_url) window.open(mat.file_url, "_blank");
                      else if (mat.external_url) window.open(mat.external_url, "_blank");
                    }}
                    className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                      {mat.material_type === "video" ? (
                        <BookOpen size={18} className="text-primary" />
                      ) : (
                        <FileText size={18} className="text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{mat.title}</p>
                      {mat.description && (
                        <p className="text-xs text-muted-foreground truncate">{mat.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                        {mat.material_type} · {new Date(mat.created_at).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border py-10 text-center">
                <FileText size={22} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No materials shared yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnrollmentDetail;
