import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useProviderRegistrations,
  useProviderStats,
  useProviderTodaySchedule,
  useProviderUpcomingSchedule,
  usePendingEnrollments,
  useProviderClassActionItems,
  useRespondToClassTerms,
  useProviderActiveBatches,
} from "@/hooks/useProvider";
import { useProviderFeaturedRequests, useProviderRespondToFeaturedFee } from "@/hooks/useFeatured";
import { toast } from "sonner";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useState } from "react";
import {
  Users,
  BookOpen,
  Wallet,
  Clock,
  Plus,
  ClipboardCheck,
  AlertCircle,
  GraduationCap,
  CalendarDays,
  FileCheck,
  Star,
  XCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const { providerProfile } = useUser();
  const providerId = providerProfile?.id;

  const { data: registrations, isLoading: regsLoading } = useProviderRegistrations(providerId);

  const approvedRegs = registrations?.filter((r) => r.status === "approved") ?? [];
  const rejectedRegs = registrations?.filter((r) => r.status === "rejected") ?? [];
  const approvedRegIds = approvedRegs.map((r) => r.id);
  const allRegIds = registrations?.map((r) => r.id) ?? [];
  const hasApproved = approvedRegs.length > 0;

  const { data: stats, isLoading: statsLoading } = useProviderStats(providerId, approvedRegIds);
  const { data: todaySchedule } = useProviderTodaySchedule(providerId, approvedRegIds);
  const { data: upcomingSchedule } = useProviderUpcomingSchedule(providerId, approvedRegIds);
  const { data: pendingEnrollments } = usePendingEnrollments(providerId, approvedRegIds);
  const { data: classActionItems } = useProviderClassActionItems(allRegIds);
  const { data: featuredRequests } = useProviderFeaturedRequests(providerId, approvedRegIds);

  const { data: allBatches } = useProviderActiveBatches(providerId, approvedRegIds);
  const respondToFee = useProviderRespondToFeaturedFee();
  const respondToClassTerms = useRespondToClassTerms();
  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [respondingClassId, setRespondingClassId] = useState<string | null>(null);

  // Featured listings with fee proposed (need provider acceptance)
  const pendingFeaturedFees = featuredRequests?.filter((r) => r.fee_status === "fee_proposed") ?? [];
  // Featured listings pending admin approval
  const pendingFeaturedApproval = featuredRequests?.filter((r) => r.status === "pending_approval") ?? [];
  // Featured listings deactivated by admin
  const deactivatedFeatured = featuredRequests?.filter((r) => r.status === "inactive") ?? [];

  // Class-level action items
  const classTermsPending = classActionItems?.filter((c) => c.class_terms_status === "pending_acceptance") ?? [];
  const classesRejected = classActionItems?.filter((c) => c.common_area_approval_status === "rejected") ?? [];
  const classesPendingReview = classActionItems?.filter(
    (c) => c.status === "pending_approval" && c.class_terms_status !== "pending_acceptance"
  ) ?? [];

  const handleRespondToClassTerms = async (classId: string, accept: boolean) => {
    setRespondingClassId(classId);
    try {
      await respondToClassTerms.mutateAsync({ classId, accept });
      if (accept) {
        toast.success("Terms accepted! Class is now published.");
      } else {
        toast.success("Terms rejected. Admin will be notified.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setRespondingClassId(null);
    }
  };

  // Total actionable count
  const actionCount =
    classTermsPending.length +
    classesRejected.length +
    pendingFeaturedFees.length +
    deactivatedFeatured.length +
    (pendingEnrollments?.length ?? 0);

  // Suspended/rejected state — no approved apartments
  if (!regsLoading && !hasApproved) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-20">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-provider/10">
            <GraduationCap size={36} className="text-provider" />
          </div>
          <h2 className="text-lg font-bold">No Active Registrations</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Your apartment registrations have been suspended or rejected. Re-apply to start offering classes.
          </p>
          {rejectedRegs.length > 0 && (
            <div className="w-full max-w-sm space-y-2 mt-4">
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
              <Button
                onClick={() => navigate("/become-provider")}
                className="w-full mt-3 bg-provider hover:bg-provider/90 text-white"
              >
                Re-apply as Provider
              </Button>
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
              {/* Class terms pending acceptance */}
              {classTermsPending.map((c) => (
                <Card key={c.id} className="p-3 border-amber-200 bg-amber-50/50 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                      <FileCheck size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Commercial terms to review</p>
                      <p className="text-xs text-muted-foreground">{c.title}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100" onClick={() => navigate(`/provider/terms/${c.id}`)}>
                      View
                    </Button>
                  </div>
                  <div className="flex gap-2 pl-11">
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700 text-white"
                      disabled={respondingClassId === c.id}
                      onClick={() => handleRespondToClassTerms(c.id, true)}
                    >
                      {respondingClassId === c.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} className="mr-1" />}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1 border-red-300 text-red-600 hover:bg-red-50"
                      disabled={respondingClassId === c.id}
                      onClick={() => handleRespondToClassTerms(c.id, false)}
                    >
                      {respondingClassId === c.id ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} className="mr-1" />}
                      Reject
                    </Button>
                  </div>
                </Card>
              ))}

              {/* Class rejected by admin */}
              {classesRejected.map((c) => (
                <Card key={c.id} className="p-3 border-red-200 bg-red-50/50 space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                      <XCircle size={16} className="text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Class not approved</p>
                      <p className="text-xs text-muted-foreground">{c.title}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => navigate(`/provider/classes/${c.id}`)}>
                      Edit
                    </Button>
                  </div>
                  {c.common_area_rejection_reason && (
                    <p className="text-[11px] text-red-700 pl-11">Reason: {c.common_area_rejection_reason}</p>
                  )}
                </Card>
              ))}

              {/* Classes pending admin review (info only) */}
              {classesPendingReview.map((c) => (
                <Card key={c.id} className="flex items-center gap-3 p-3 opacity-75">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                    <BookOpen size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Awaiting admin review</p>
                    <p className="text-xs text-muted-foreground">{c.title}</p>
                  </div>
                  <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">Pending</Badge>
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

              {/* Featured listings deactivated by admin (info only) */}
              {deactivatedFeatured.map((f) => (
                <Card key={f.id} className="p-3 border-orange-200 bg-orange-50/50 space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                      <Star size={16} className="text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Featured listing deactivated</p>
                      <p className="text-xs text-muted-foreground">
                        {(f.classes as any)?.title}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                      Inactive
                    </Badge>
                  </div>
                  {(f as any).deactivation_reason && (
                    <p className="text-[11px] text-orange-700 pl-11">
                      Reason: {(f as any).deactivation_reason}
                    </p>
                  )}
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 border-provider text-provider"
                    onClick={() => navigate(`/provider/attendance/${s.batchId}`)}
                  >
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

        {/* Mark Past Attendance */}
        {allBatches && allBatches.length > 0 && (
          <div>
            <Button
              variant="outline"
              className="w-full text-xs h-10 border-provider/30 text-provider hover:bg-provider/5"
              onClick={() => setShowBatchPicker(true)}
            >
              <ClipboardCheck size={14} className="mr-2" />
              Mark Past Attendance
            </Button>
          </div>
        )}

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

      {/* Batch Picker Sheet for Past Attendance */}
      <Sheet open={showBatchPicker} onOpenChange={setShowBatchPicker}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto">
          <SheetHeader className="pb-3">
            <SheetTitle>Select Batch for Attendance</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 pb-6">
            {allBatches?.map((b) => (
              <Card
                key={b.batchId}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50 active:scale-[0.99] transition-all"
                onClick={() => {
                  setShowBatchPicker(false);
                  navigate(`/provider/attendance/${b.batchId}`);
                }}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-provider/10">
                  <ClipboardCheck size={16} className="text-provider" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.classTitle}</p>
                  <p className="text-xs text-muted-foreground">{b.batchName}</p>
                </div>
              </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderDashboard;
