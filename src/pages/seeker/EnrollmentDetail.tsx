import { useParams, useNavigate } from "react-router-dom";
import {
  useEnrollmentDetail,
  useEnrollmentAttendance,
  useEnrollmentPayments,
  useEnrollmentMaterials,
} from "@/hooks/useSeeker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold truncate">{cls?.title}</h1>
          <p className="text-xs text-muted-foreground truncate">{batch.batch_name}</p>
        </div>
        <Badge className={`text-[10px] border-0 ${enrollment.status === "active" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {enrollment.status}
        </Badge>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        {/* Quick info card */}
        <Card className="p-4 space-y-2">
          {member && (
            <p className="text-xs text-muted-foreground">
              {member.name} · {member.relationship}
            </p>
          )}
          {schedules.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Calendar size={12} className="text-muted-foreground" />
              <span>{schedules.map((s: any) => DAY_NAMES[s.day_of_week]).join(", ")}</span>
              <span>·</span>
              <Clock size={12} className="text-muted-foreground" />
              <span>{schedules[0]?.start_time?.slice(0, 5)}–{schedules[0]?.end_time?.slice(0, 5)}</span>
            </div>
          )}
          {cls?.venue_details && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={12} />
              <span>{cls.venue_details}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            <CreditCard size={12} className="text-muted-foreground" />
            <span className="font-semibold">₹{batch.fee_amount}{FEE_LABELS[batch.fee_frequency] ?? ""}</span>
          </div>
        </Card>

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
                  <Card key={i} className="flex items-center gap-3 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <span className="text-xs font-bold text-primary">{DAY_NAMES[s.day_of_week]}</span>
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
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{attendanceRate}%</p>
                <p className="text-[10px] text-muted-foreground">Rate</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold">{presentCount}</p>
                <p className="text-[10px] text-muted-foreground">Present</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{absentCount}</p>
                <p className="text-[10px] text-muted-foreground">Absent</p>
              </Card>
            </div>

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
    </div>
  );
};

export default EnrollmentDetail;
