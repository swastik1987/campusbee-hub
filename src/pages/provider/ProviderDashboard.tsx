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
import { useProviderFeaturedRequests, useProviderRespondToFeaturedFee } from "@/hooks/useFeatured";
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
  FileCheck,
  Star,
  Building2,
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
  const { data: featuredRequests } = useProviderFeaturedRequests(providerId, approvedRegIds);

  const respondToFee = useProviderRespondToFeaturedFee();

  // Featured listings with fee proposed (need provider acceptance)
  const pendingFeaturedFees = featuredRequests?.filter((r) => r.fee_status === "fee_proposed") ?? [];
  // Featured listings pending admin approval
  const pendingFeaturedApproval = featuredRequests?.filter((r) => r.status === "pending_approval") ?? [];

  // Total actionable count
  const actionCount =
    (pendingTerms?.length ?? 0) +
    pendingFeaturedFees.length +
    (pendingEnrollments?.length ?? 0) +
    pendingRegs.length;

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
        {/* Pending Actionables */}
        {actionCount > 0 && (
          <div>
            <h2 className="mb-3 text-base font-bold flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-500" />
              Action Required
              <Badge className="bg-amber-500 text-white text-[10px] h-5 px-1.5">
                {actionCount}
              </Badge>
            </h2>
            <div className="space-y-2">
              {/* Commercial terms acceptance */}
              {(pendingTerms ?? []).map((t) => (
                <Card key={t.id} className="flex items-center gap-3 p-3 border-amber-200 bg-amber-50/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                    <FileCheck size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Commercial terms to accept</p>
                    <p className="text-xs text-muted-foreground">
                      {(t.apartment_complexes as any)?.name}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100" onClick={() => navigate("/provider/terms")}>
                    Review
                  </Button>
                </Card>
              ))}

              {/* Featured listing fee acceptance */}
              {pendingFeaturedFees.map((f) => (
                <Card key={f.id} className="p-3 border-purple-200 bg-purple-50/50 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                      <Star size={16} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{(f.classes as any)?.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Ad fee: <span className="font-semibold text-purple-700">₹{f.ad_fee}</span>
                        {f.valid_from && f.valid_until && (
                          <> · {new Date(f.valid_from).toLocaleDateString()} — {new Date(f.valid_until).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pl-11">
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 bg-provider hover:bg-provider/90 text-white"
                      disabled={respondToFee.isPending}
                      onClick={() => respondToFee.mutate({ listingId: f.id, accept: true })}
                    >
                      Accept Fee
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1"
                      disabled={respondToFee.isPending}
                      onClick={() => respondToFee.mutate({ listingId: f.id, accept: false })}
                    >
                      Reject
                    </Button>
                  </div>
                </Card>
              ))}

              {/* Pending apartment approvals */}
              {pendingRegs.map((r) => (
                <Card key={r.id} className="flex items-center gap-3 p-3 border-amber-200 bg-amber-50/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                    <Building2 size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Awaiting admin approval</p>
                    <p className="text-xs text-muted-foreground">
                      {(r.apartment_complexes as any)?.name} · {(r.apartment_complexes as any)?.locality}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                    Pending
                  </Badge>
                </Card>
              ))}

              {/* Pending enrollment requests */}
              {(pendingEnrollments ?? []).map((e) => (
                <Card key={e.enrollmentId} className="flex items-center gap-3 p-3 border-amber-200 bg-amber-50/50">
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

              {/* Featured listings pending admin approval (info only) */}
              {pendingFeaturedApproval.map((f) => (
                <Card key={f.id} className="flex items-center gap-3 p-3 opacity-70">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                    <Star size={16} className="text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Featured request under review</p>
                    <p className="text-xs text-muted-foreground">
                      {(f.classes as any)?.title}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-gray-500 border-gray-300 text-xs">
                    Waiting
                  </Badge>
                </Card>
              ))}
            </div>
          </div>
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

        {/* No pending actions placeholder */}
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
