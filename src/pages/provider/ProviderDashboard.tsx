import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import UpgradeRequestSheet from "@/components/subscription/UpgradeRequestSheet";
import {
  useProviderStats,
  useProviderTodaySchedule,
  useProviderUpcomingSchedule,
  usePendingEnrollments,
  useProviderActiveBatches,
} from "@/hooks/useProvider";
import { useProviderCategoryRequests } from "@/hooks/useCategoryRequests";
import CertificationManager from "@/components/provider/CertificationManager";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Users,
  BookOpen,
  Wallet,
  Clock,
  Plus,
  ClipboardCheck,
  AlertCircle,
  Award,
  CalendarDays,
  CheckCircle2,
  XCircle,
  FolderTree,
  Crown,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


const ProviderDashboard = () => {
  const navigate = useNavigate();
  const { providerProfile, isPremium } = useUser();
  const providerId = providerProfile?.id;

  const { data: stats, isLoading: statsLoading } = useProviderStats(providerId);
  const { data: todaySchedule } = useProviderTodaySchedule(providerId);
  const { data: upcomingSchedule } = useProviderUpcomingSchedule(providerId);
  const { data: pendingEnrollments } = usePendingEnrollments(providerId);
  const { data: allBatches } = useProviderActiveBatches(providerId);
  const { data: catRequests } = useProviderCategoryRequests(providerId);

  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [showCerts, setShowCerts] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  const actionCount = pendingEnrollments?.length ?? 0;
  const pendingCatRequests = (catRequests ?? []).filter((r) => r.status === "pending");
  const rejectedCatRequests = (catRequests ?? []).filter((r) => r.status === "rejected");

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
              {/* Pending enrollment requests */}
              {(pendingEnrollments ?? []).map((e) => (
                <Card
                  key={e.enrollmentId}
                  className="flex items-center gap-3 p-3 border-amber-200 bg-amber-50/50 cursor-pointer hover:bg-amber-100/60 active:scale-[0.99] transition-all"
                  onClick={() => navigate("/provider/students?tab=pending")}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 shrink-0">
                    <Users size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.memberName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.classTitle} · {e.batchName}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-[11px] border-amber-400 text-amber-700 hover:bg-amber-100 shrink-0"
                    onClick={(ev) => { ev.stopPropagation(); navigate("/provider/students?tab=pending"); }}
                  >
                    Review
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats — sticky, clickable */}
        <div className="sticky top-14 z-30 -mx-4 border-b border-border/40 bg-background/95 px-4 py-2 backdrop-blur-sm">
          <div className="grid grid-cols-3 gap-3">
            {statsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            ) : (
              <>
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate("/provider/classes")}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate("/provider/classes"); }}
                  className="group relative flex cursor-pointer flex-col items-center justify-center gap-1 border-provider/30 bg-provider/5 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-provider hover:bg-provider/10 hover:shadow-md active:scale-95"
                >
                  <BookOpen size={20} className="text-provider" />
                  <span className="text-lg font-bold">{stats?.activeClasses ?? 0}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">Classes</span>
                  <ChevronRight size={12} className="absolute right-1.5 top-1.5 text-provider/60 transition-transform group-hover:translate-x-0.5" />
                </Card>
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate("/provider/students")}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate("/provider/students"); }}
                  className="group relative flex cursor-pointer flex-col items-center justify-center gap-1 border-provider/30 bg-provider/5 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-provider hover:bg-provider/10 hover:shadow-md active:scale-95"
                >
                  <Users size={20} className="text-provider" />
                  <span className="text-lg font-bold">{stats?.activeStudents ?? 0}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">Students</span>
                  <ChevronRight size={12} className="absolute right-1.5 top-1.5 text-provider/60 transition-transform group-hover:translate-x-0.5" />
                </Card>
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate("/provider/payments")}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate("/provider/payments"); }}
                  className="group relative flex cursor-pointer flex-col items-center justify-center gap-1 border-provider/30 bg-provider/5 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-provider hover:bg-provider/10 hover:shadow-md active:scale-95"
                >
                  <Wallet size={20} className="text-provider" />
                  <span className="text-lg font-bold">{stats?.pendingPayments ?? 0}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">Payments</span>
                  <ChevronRight size={12} className="absolute right-1.5 top-1.5 text-provider/60 transition-transform group-hover:translate-x-0.5" />
                  {(stats?.pendingPayments ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] text-white font-bold">
                      {stats?.pendingPayments}
                    </span>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Subscription tier banner */}
        {isPremium ? (
          <Card
            className="flex items-center gap-3 p-3 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 cursor-pointer"
            onClick={() => navigate("/provider/subscription")}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 shrink-0">
              <Crown size={16} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Premium Plan</p>
              {providerProfile?.subscription_valid_until && (
                <p className="text-[10px] text-amber-700">
                  Active until{" "}
                  {new Date(providerProfile.subscription_valid_until).toLocaleDateString(
                    "en-IN", { day: "numeric", month: "short", year: "numeric" }
                  )}
                </p>
              )}
            </div>
            <ArrowRight size={14} className="text-amber-500 shrink-0" />
          </Card>
        ) : (
          <Card
            className="flex items-center gap-3 p-3 border-dashed border-amber-200 cursor-pointer hover:bg-amber-50/50 transition-colors"
            onClick={() => setShowUpgrade(true)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 shrink-0">
              <Crown size={16} className="text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Upgrade to Premium</p>
              <p className="text-[10px] text-muted-foreground">
                Unlock analytics, sponsored listings &amp; more
              </p>
            </div>
            <ArrowRight size={14} className="text-muted-foreground shrink-0" />
          </Card>
        )}

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
          <Collapsible open={upcomingOpen} onOpenChange={setUpcomingOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg py-1 text-left">
              <h2 className="text-base font-bold flex items-center gap-2">
                <CalendarDays size={18} className="text-provider" />
                Upcoming Schedule
              </h2>
              <ChevronDown
                size={18}
                className={`text-muted-foreground transition-transform ${upcomingOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
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
            </CollapsibleContent>
          </Collapsible>
        )}
        {/* Category Requests Status */}
        {((pendingCatRequests.length > 0) || (rejectedCatRequests.length > 0)) && (
          <div>
            <h2 className="mb-3 text-base font-bold flex items-center gap-2">
              <FolderTree size={18} className="text-provider" />
              Category Requests
            </h2>
            <div className="space-y-2">
              {pendingCatRequests.map((r) => (
                <Card key={r.id} className="flex items-center gap-3 p-3 border-amber-200 bg-amber-50/50">
                  <Clock size={16} className="text-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.requested_name}</p>
                    <p className="text-xs text-muted-foreground">Awaiting review</p>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Pending</Badge>
                </Card>
              ))}
              {rejectedCatRequests.map((r) => (
                <Card key={r.id} className="flex items-center gap-3 p-3 border-red-200 bg-red-50/50">
                  <XCircle size={16} className="text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.requested_name}</p>
                    {r.admin_notes && (
                      <p className="text-xs text-red-600 line-clamp-1">{r.admin_notes}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-red-600 border-red-300 text-xs">Rejected</Badge>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {providerId && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Award size={18} className="text-provider" />
                My Certifications
              </h2>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-provider h-7"
                onClick={() => setShowCerts(true)}
              >
                Manage
              </Button>
            </div>
            <Card className="p-4 text-sm text-muted-foreground border-dashed cursor-pointer hover:border-provider/50 transition-colors" onClick={() => setShowCerts(true)}>
              <div className="flex items-center gap-2">
                <Award size={16} className="text-provider" />
                <span>Add certificates, degrees & credentials to build trust</span>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-30">
        <Button
          onClick={() => navigate("/provider/classes/new")}
          className="h-12 w-12 rounded-full bg-provider hover:bg-provider/90 text-white shadow-lg"
        >
          <Plus size={24} />
        </Button>
      </div>

      {/* Certifications Sheet */}
      <Sheet open={showCerts} onOpenChange={setShowCerts}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-3">
            <SheetTitle>My Certifications</SheetTitle>
          </SheetHeader>
          {providerId && (
            <CertificationManager ownerType="provider" providerId={providerId} />
          )}
        </SheetContent>
      </Sheet>

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

      <UpgradeRequestSheet open={showUpgrade} onOpenChange={setShowUpgrade} />
      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderDashboard;
