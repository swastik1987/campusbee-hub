import { useRef, useState } from "react";
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
import {
  usePendingBatchSwitches,
  useProviderApproveBatchSwitch,
  useProviderRejectBatchSwitch,
} from "@/hooks/useEngagement";
import {
  useProviderCategoryRequests,
  useRespondToRetag,
} from "@/hooks/useCategoryRequests";
import SwipeToDismiss from "@/components/provider/SwipeToDismiss";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  ImagePlus,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

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
  const { data: pendingSwitches } = usePendingBatchSwitches(providerId);
  const approveSwitch = useProviderApproveBatchSwitch();
  const rejectSwitch = useProviderRejectBatchSwitch();

  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const certAddTriggerRef = useRef<(() => void) | null>(null);

  const switchCount = pendingSwitches?.length ?? 0;
  const actionCount = (pendingEnrollments?.length ?? 0) + switchCount;
  const respondToRetag = useRespondToRetag();
  const [respondingCatReqId, setRespondingCatReqId] = useState<string | null>(null);
  const pendingCatRequests = (catRequests ?? []).filter(
    (r) => r.status === "pending",
  );
  const historyCatRequests = (catRequests ?? []).filter(
    (r) => r.status !== "pending",
  );

  const handleRetagResponse = async (requestId: string, accepted: boolean) => {
    setRespondingCatReqId(requestId);
    try {
      await respondToRetag.mutateAsync({ requestId, accepted });
      toast.success(
        accepted
          ? "Accepted — you can now use that category for your classes."
          : "Declined. You can submit a new request if needed.",
      );
    } catch {
      toast.error("Failed to respond. Please try again.");
    } finally {
      setRespondingCatReqId(null);
    }
  };

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
              {/* Pending batch-switch requests */}
              {(pendingSwitches ?? []).map((s) => (
                <Card
                  key={`switch-${s.enrollmentId}`}
                  className="flex flex-col gap-2 p-3 border-amber-200 bg-amber-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 shrink-0">
                      <ArrowRightLeft size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.memberName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.classTitle}: {s.fromBatchName} → {s.toBatchName}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-[11px] border-red-300 text-red-700 hover:bg-red-50"
                      disabled={rejectSwitch.isPending || approveSwitch.isPending}
                      onClick={async () => {
                        try {
                          await rejectSwitch.mutateAsync({ enrollmentId: s.enrollmentId });
                          toast.success("Switch declined");
                        } catch (err: any) {
                          toast.error(err?.message ?? "Failed to decline");
                        }
                      }}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-[11px] bg-green-600 hover:bg-green-700 text-white"
                      disabled={approveSwitch.isPending || rejectSwitch.isPending}
                      onClick={async () => {
                        try {
                          await approveSwitch.mutateAsync(s.enrollmentId);
                          toast.success("Switch approved");
                        } catch (err: any) {
                          toast.error(err?.message ?? "Failed to approve");
                        }
                      }}
                    >
                      Approve
                    </Button>
                  </div>
                </Card>
              ))}
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
        ) : null}
        {isPremium && (
          <Card
            className="flex cursor-pointer items-center gap-3 border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-3"
            onClick={() => navigate("/provider/sponsored")}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
              <Crown size={16} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-900">Sponsored & Featured</p>
              <p className="text-[10px] text-indigo-700">
                Promote your classes with sponsored slots and banners
              </p>
            </div>
            <ArrowRight size={14} className="shrink-0 text-indigo-500" />
          </Card>
        )}
        {!isPremium && (
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
        {/* Category Requests Status — Active (pending) + History (dismissible) */}
        {(pendingCatRequests.length > 0 || historyCatRequests.length > 0) && (
          <div>
            <h2 className="mb-3 text-base font-bold flex items-center gap-2">
              <FolderTree size={18} className="text-provider" />
              Category Requests
            </h2>
            <Tabs defaultValue={pendingCatRequests.length > 0 ? "active" : "history"}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active" className="text-xs">
                  Active
                  {pendingCatRequests.length > 0 && (
                    <Badge className="ml-1.5 h-4 bg-amber-500 px-1 text-[9px] text-white">
                      {pendingCatRequests.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  History
                  {historyCatRequests.length > 0 && (
                    <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[9px]">
                      {historyCatRequests.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-3 space-y-2">
                {pendingCatRequests.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No pending category requests
                  </p>
                ) : (
                  pendingCatRequests.map((r) => (
                    // Locked: pending requests can't be dismissed
                    <SwipeToDismiss key={r.id} locked onDismiss={() => {}}>
                      <Card className="flex items-center gap-3 border-amber-200 bg-amber-50/50 p-3">
                        <Clock size={16} className="flex-shrink-0 text-amber-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{r.requested_name}</p>
                          <p className="text-xs text-muted-foreground">Awaiting review</p>
                        </div>
                        <Badge variant="outline" className="border-amber-300 text-xs text-amber-600">
                          Pending
                        </Badge>
                      </Card>
                    </SwipeToDismiss>
                  ))
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-3 space-y-2">
                {historyCatRequests.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No past category requests yet.
                  </p>
                ) : (
                  historyCatRequests.map((r) => {
                    const isApproved = r.status === "approved";
                    const isRejected = r.status === "rejected";
                    const isRetagPending = r.status === "retag_pending";
                    const isResponding = respondingCatReqId === r.id;
                    return (
                      <Card
                        key={r.id}
                        className={`p-3 ${
                          isApproved
                            ? "border-emerald-200 bg-emerald-50/50"
                            : isRejected
                            ? "border-red-200 bg-red-50/50"
                            : isRetagPending
                            ? "border-blue-200 bg-blue-50/50"
                            : "border-muted bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {isApproved ? (
                            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                          ) : isRejected ? (
                            <XCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                          ) : isRetagPending ? (
                            <FolderTree size={16} className="mt-0.5 flex-shrink-0 text-blue-600" />
                          ) : (
                            <Clock size={16} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium">{r.requested_name}</p>
                            {isRetagPending && r.retag_cat && (
                              <p className="text-xs text-blue-800">
                                Admin suggests mapping this to existing category:{" "}
                                <span className="font-semibold">{r.retag_cat.name}</span>
                              </p>
                            )}
                            {r.admin_notes && (
                              <p
                                className={`whitespace-pre-wrap break-words text-xs ${
                                  isRejected
                                    ? "text-red-600"
                                    : isRetagPending
                                    ? "text-blue-700"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {r.admin_notes}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`flex-shrink-0 text-xs ${
                              isApproved
                                ? "border-emerald-300 text-emerald-700"
                                : isRejected
                                ? "border-red-300 text-red-600"
                                : isRetagPending
                                ? "border-blue-300 text-blue-700"
                                : "text-muted-foreground"
                            }`}
                          >
                            {r.status === "retag_declined"
                              ? "Declined"
                              : isRetagPending
                              ? "Action Required"
                              : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </Badge>
                        </div>
                        {isRetagPending && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 gap-1 border-red-200 text-xs text-red-600 hover:bg-red-50"
                              disabled={isResponding}
                              onClick={() => handleRetagResponse(r.id, false)}
                            >
                              {isResponding ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <X size={12} />
                              )}
                              Decline
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 gap-1 bg-green-600 text-xs text-white hover:bg-green-700"
                              disabled={isResponding}
                              onClick={() => handleRetagResponse(r.id, true)}
                            >
                              {isResponding ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                              Accept
                            </Button>
                          </div>
                        )}
                      </Card>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
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
                variant="outline"
                className="h-8 gap-1 text-xs border-provider/40 text-provider"
                onClick={() => certAddTriggerRef.current?.()}
              >
                <ImagePlus size={13} /> Add
              </Button>
            </div>
            <CertificationManager
              ownerType="provider"
              providerId={providerId}
              maxVisible={3}
              hideTitle
              addTriggerRef={certAddTriggerRef}
            />
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
