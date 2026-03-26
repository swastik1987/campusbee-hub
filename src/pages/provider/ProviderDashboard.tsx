import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useProviderRegistrations,
  useProviderStats,
  useProviderTodaySchedule,
  useProviderUpcomingSchedule,
  usePendingEnrollments,
  useProviderPendingTerms,
} from "@/hooks/useProvider";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  BookOpen,
  Wallet,
  Clock,
  Plus,
  ClipboardCheck,
  AlertCircle,
  GraduationCap,
  Megaphone,
  CalendarDays,
} from "lucide-react";

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const { providerProfile } = useUser();
  const providerId = providerProfile?.id;

  const { data: registrations, isLoading: regsLoading } = useProviderRegistrations(providerId);

  const approvedRegs = registrations?.filter((r) => r.status === "approved") ?? [];
  const pendingRegs = registrations?.filter((r) => r.status === "pending") ?? [];
  const rejectedRegs = registrations?.filter((r) => r.status === "rejected") ?? [];
  const approvedRegIds = approvedRegs.map((r) => r.id);
  const hasApproved = approvedRegs.length > 0;

  const { data: stats, isLoading: statsLoading } = useProviderStats(providerId, approvedRegIds);
  const { data: todaySchedule } = useProviderTodaySchedule(providerId, approvedRegIds);
  const { data: upcomingSchedule } = useProviderUpcomingSchedule(providerId, approvedRegIds);
  const { data: pendingEnrollments } = usePendingEnrollments(providerId, approvedRegIds);
  const { data: pendingTerms } = useProviderPendingTerms(providerId);

  // Pending state — no approved apartments yet
  if (!regsLoading && !hasApproved) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-20">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-provider/10">
            <GraduationCap size={36} className="text-provider" />
          </div>
          <h2 className="text-lg font-bold">Applications Under Review</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Your applications are being reviewed by apartment admins. You'll be notified once approved.
          </p>
          {(pendingRegs.length > 0 || rejectedRegs.length > 0) && (
            <div className="w-full max-w-sm space-y-2 mt-4">
              {pendingRegs.map((r) => (
                <Card key={r.id} className="flex items-center gap-3 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                    <Clock size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {(r.apartment_complexes as any)?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(r.apartment_complexes as any)?.locality}, {(r.apartment_complexes as any)?.city}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Pending
                  </Badge>
                </Card>
              ))}
              {rejectedRegs.map((r) => (
                <Card key={r.id} className="flex items-center gap-3 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                    <AlertCircle size={16} className="text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {(r.apartment_complexes as any)?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(r.apartment_complexes as any)?.locality}, {(r.apartment_complexes as any)?.city}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-red-600 border-red-300">
                    Rejected
                  </Badge>
                </Card>
              ))}
              {rejectedRegs.length > 0 && pendingRegs.length === 0 && (
                <Button
                  onClick={() => navigate("/become-provider")}
                  className="w-full mt-3 bg-provider hover:bg-provider/90 text-white"
                >
                  Re-apply as Provider
                </Button>
              )}
            </div>
          )}
        </div>
        <BottomNav persona="provider" />
      </div>
    );
  }

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-6">
        {/* Pending Terms Banner */}
        {(pendingTerms?.length ?? 0) > 0 && (
          <Card className="flex items-center gap-3 border-amber-300 bg-amber-50 p-3">
            <AlertCircle size={20} className="shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {pendingTerms!.length} commercial term{pendingTerms!.length > 1 ? "s" : ""} to review
              </p>
              <p className="text-xs text-amber-600">Accept terms to start listing classes</p>
            </div>
            <Button size="sm" variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-100" onClick={() => navigate("/provider/terms")}>
              Review
            </Button>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          {statsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : (
            <>
              <Card className="flex flex-col items-center justify-center gap-1 p-3">
                <Users size={20} className="text-provider" />
                <span className="text-lg font-bold">{stats?.activeStudents ?? 0}</span>
                <span className="text-[10px] text-muted-foreground">Students</span>
              </Card>
              <Card className="flex flex-col items-center justify-center gap-1 p-3">
                <BookOpen size={20} className="text-provider" />
                <span className="text-lg font-bold">{stats?.activeClasses ?? 0}</span>
                <span className="text-[10px] text-muted-foreground">Classes</span>
              </Card>
              <Card className="flex flex-col items-center justify-center gap-1 p-3 relative">
                <Wallet size={20} className="text-provider" />
                <span className="text-lg font-bold">{stats?.pendingPayments ?? 0}</span>
                <span className="text-[10px] text-muted-foreground">Pending Pay</span>
                {(stats?.pendingPayments ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] text-white font-bold">
                    {stats?.pendingPayments}
                  </span>
                )}
              </Card>
            </>
          )}
        </div>

        {/* Today's Schedule */}
        <div>
          <h2 className="mb-3 text-base font-bold flex items-center gap-2">
            <Clock size={18} className="text-provider" />
            Today's Schedule
          </h2>
          {todaySchedule && todaySchedule.length > 0 ? (
            <div className="space-y-2">
              {todaySchedule.map((s) => (
                <Card key={s.scheduleId} className="flex items-center gap-3 p-3">
                  <div className="text-center min-w-[50px]">
                    <p className="text-xs font-bold text-provider">
                      {s.startTime?.slice(0, 5)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.endTime?.slice(0, 5)}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{s.classTitle}</p>
                    <p className="text-xs text-muted-foreground">{s.batchName}</p>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs h-8 border-provider text-provider">
                    <ClipboardCheck size={14} className="mr-1" />
                    Attendance
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="flex items-center gap-3 p-4 text-center justify-center">
              <p className="text-sm text-muted-foreground">No classes scheduled today</p>
            </Card>
          )}
        </div>

        {/* Upcoming 3-Day Schedule */}
        {upcomingSchedule && upcomingSchedule.some((d) => d.schedules.length > 0) && (
          <div>
            <h2 className="mb-3 text-base font-bold flex items-center gap-2">
              <CalendarDays size={18} className="text-provider" />
              Upcoming Schedule
            </h2>
            <div className="space-y-3">
              {upcomingSchedule.map((day) => {
                const label = day.date.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
                return (
                  <div key={day.dayOfWeek}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
                    {day.schedules.length > 0 ? (
                      <div className="space-y-1.5">
                        {day.schedules.map((s) => (
                          <Card key={s.scheduleId} className="flex items-center gap-3 p-3 bg-muted/40">
                            <div className="text-center min-w-[50px]">
                              <p className="text-xs font-bold text-provider">{s.startTime?.slice(0, 5)}</p>
                              <p className="text-[10px] text-muted-foreground">{s.endTime?.slice(0, 5)}</p>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{s.classTitle}</p>
                              <p className="text-xs text-muted-foreground">{s.batchName}</p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic pl-1">No classes</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Required */}
        {pendingEnrollments && pendingEnrollments.length > 0 && (
          <div>
            <h2 className="mb-3 text-base font-bold flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-500" />
              Action Required
            </h2>
            <div className="space-y-2">
              {pendingEnrollments.map((e) => (
                <Card key={e.enrollmentId} className="flex items-center gap-3 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                    <Users size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{e.memberName}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.classTitle} · {e.batchName}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                    Review
                  </Badge>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-30 flex flex-col gap-2 items-end">
        <Button
          onClick={() => navigate("/provider/classes/new")}
          className="h-12 w-12 rounded-full bg-provider hover:bg-provider/90 text-white shadow-lg"
        >
          <Plus size={24} />
        </Button>
      </div>

      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderDashboard;
