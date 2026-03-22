import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useBatchEnrolledStudents,
  useBatchAttendanceForDate,
  useSubmitAttendance,
} from "@/hooks/useEngagement";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Check, CheckCheck, Loader2, X } from "lucide-react";
import { toast } from "sonner";

type AttendanceStatus = "present" | "absent" | "late";

const STATUS_STYLES: Record<AttendanceStatus, { bg: string; text: string; label: string }> = {
  present: { bg: "bg-green-100", text: "text-green-700", label: "P" },
  absent: { bg: "bg-red-100", text: "text-red-700", label: "A" },
  late: { bg: "bg-amber-100", text: "text-amber-700", label: "L" },
};

const TakeAttendance = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { profile } = useUser();

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  const { data: students, isLoading } = useBatchEnrolledStudents(batchId);
  const { data: existingRecords } = useBatchAttendanceForDate(batchId, date);
  const submitAttendance = useSubmitAttendance();

  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});

  // Initialize statuses from existing records or default to present
  useEffect(() => {
    if (!students) return;
    const init: Record<string, AttendanceStatus> = {};
    students.forEach((s) => {
      const existing = existingRecords?.find((r) => r.enrollment_id === s.id);
      init[s.id] = (existing?.status as AttendanceStatus) ?? "present";
    });
    setStatuses(init);
  }, [students, existingRecords]);

  const toggleStatus = (enrollmentId: string) => {
    setStatuses((prev) => {
      const current = prev[enrollmentId] ?? "present";
      const next: AttendanceStatus = current === "present" ? "absent" : current === "absent" ? "late" : "present";
      return { ...prev, [enrollmentId]: next };
    });
  };

  const markAllPresent = () => {
    if (!students) return;
    const all: Record<string, AttendanceStatus> = {};
    students.forEach((s) => { all[s.id] = "present"; });
    setStatuses(all);
  };

  const handleSubmit = async () => {
    if (!profile || !batchId) return;
    const records = Object.entries(statuses).map(([enrollmentId, status]) => ({
      enrollmentId,
      status,
    }));

    try {
      await submitAttendance.mutateAsync({
        batchId,
        date,
        markedBy: profile.id,
        records,
      });
      toast.success(`Attendance marked for ${records.length} students`);
      navigate(-1);
    } catch {
      toast.error("Failed to submit attendance");
    }
  };

  const presentCount = Object.values(statuses).filter((s) => s === "present" || s === "late").length;
  const absentCount = Object.values(statuses).filter((s) => s === "absent").length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold flex-1">Take Attendance</h1>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        {/* Date selector */}
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={today}
            className="h-10 rounded-lg flex-1"
          />
          <Button size="sm" variant="outline" onClick={markAllPresent} className="text-xs whitespace-nowrap">
            <CheckCheck size={14} className="mr-1" /> All Present
          </Button>
        </div>

        {/* Summary */}
        <div className="flex gap-3">
          <Badge variant="secondary" className="text-xs">
            <span className="text-green-600 font-semibold mr-1">{presentCount}</span> Present
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <span className="text-red-600 font-semibold mr-1">{absentCount}</span> Absent
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Total: {students?.length ?? 0}
          </Badge>
        </div>

        {/* Student list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : students && students.length > 0 ? (
          <div className="space-y-2">
            {students.map((enrollment) => {
              const member = enrollment.family_members as any;
              const status = statuses[enrollment.id] ?? "present";
              const style = STATUS_STYLES[status];
              return (
                <Card
                  key={enrollment.id}
                  className="flex items-center gap-3 p-3 cursor-pointer active:scale-[0.99] transition-all"
                  onClick={() => toggleStatus(enrollment.id)}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member?.avatar_url} />
                    <AvatarFallback className="bg-muted text-xs">
                      {member?.name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member?.name}</p>
                    <p className="text-[10px] text-muted-foreground">{member?.relationship}</p>
                  </div>
                  <button
                    className={`flex h-9 w-9 items-center justify-center rounded-lg font-bold text-sm ${style.bg} ${style.text}`}
                  >
                    {style.label}
                  </button>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No enrolled students in this batch</p>
          </div>
        )}

        {students && students.length > 0 && (
          <Button
            onClick={handleSubmit}
            disabled={submitAttendance.isPending}
            className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
          >
            {submitAttendance.isPending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              "Submit Attendance"
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default TakeAttendance;
