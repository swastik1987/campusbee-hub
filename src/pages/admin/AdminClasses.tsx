import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useAdminPendingClasses,
  useAdminAllClasses,
  useAdminApproveClass,
  useAdminRejectClass,
  useAdminUpdateClassStatus,
} from "@/hooks/useAdmin";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Ban,
  BookOpen,
  Check,
  CheckCircle2,
  Home,
  Loader2,
  Play,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const AdminClasses = React.forwardRef<HTMLDivElement, Record<string, never>>((_props, ref) => {
  const navigate = useNavigate();
  const { profile, currentApartment } = useUser();
  const aptId = currentApartment?.id;

  const { data: pendingClasses, isLoading: pendingLoading } = useAdminPendingClasses(aptId);
  const { data: allClasses, isLoading: allLoading } = useAdminAllClasses(aptId);

  const approveClass = useAdminApproveClass();
  const rejectClass = useAdminRejectClass();
  const updateClassStatus = useAdminUpdateClassStatus();

  // Approve sheet
  const [approveTarget, setApproveTarget] = React.useState<any>(null);
  const [withTerms, setWithTerms] = React.useState(false);
  const [feeType, setFeeType] = React.useState("flat");
  const [feeAmount, setFeeAmount] = React.useState("");
  const [revenueSharePct, setRevenueSharePct] = React.useState("0");
  const [paymentFrequency, setPaymentFrequency] = React.useState("monthly");
  const [commercialNotes, setCommercialNotes] = React.useState("");

  // Reject sheet
  const [rejectTarget, setRejectTarget] = React.useState<any>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  // Suspend sheet
  const [suspendTarget, setSuspendTarget] = React.useState<any>(null);
  const [suspendReason, setSuspendReason] = React.useState("");

  const activeClasses = (allClasses ?? []).filter((c: any) => c.status === "published");
  const suspendedClasses = (allClasses ?? []).filter((c: any) => c.status === "paused");

  const getProviderUser = (cls: any) => {
    const prov = cls.provider_apartment_registrations?.service_providers;
    return { providerUserId: prov?.user_id as string | undefined, providerName: prov?.business_name || prov?.users?.full_name };
  };

  const handleApprove = async () => {
    if (!approveTarget || !profile) return;
    const { providerUserId } = getProviderUser(approveTarget);
    if (!providerUserId) return;
    try {
      await approveClass.mutateAsync({
        classId: approveTarget.id,
        adminUserId: profile.id,
        providerUserId,
        terms: withTerms && parseFloat(feeAmount) > 0
          ? {
              feeType,
              feeAmount: parseFloat(feeAmount),
              revenueSharePct: parseFloat(revenueSharePct) || 0,
              paymentFrequency,
              notes: commercialNotes.trim(),
            }
          : undefined,
      });
      toast.success(withTerms ? "Class approved — terms sent to provider" : "Class approved and published!");
      setApproveTarget(null);
    } catch {
      toast.error("Failed to approve class");
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    const { providerUserId } = getProviderUser(rejectTarget);
    if (!providerUserId) return;
    try {
      await rejectClass.mutateAsync({
        classId: rejectTarget.id,
        providerUserId,
        reason: rejectReason.trim(),
      });
      toast.success("Class request rejected");
      setRejectTarget(null);
      setRejectReason("");
    } catch {
      toast.error("Failed to reject class");
    }
  };

  const handleSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return;
    const { providerUserId } = getProviderUser(suspendTarget);
    if (!providerUserId) return;
    try {
      await updateClassStatus.mutateAsync({
        classId: suspendTarget.id,
        status: "paused",
        providerUserId,
        reason: suspendReason.trim(),
      });
      toast.success("Class suspended");
      setSuspendTarget(null);
      setSuspendReason("");
    } catch {
      toast.error("Failed to suspend class");
    }
  };

  const handleReactivate = async (cls: any) => {
    const { providerUserId } = getProviderUser(cls);
    if (!providerUserId) return;
    try {
      await updateClassStatus.mutateAsync({
        classId: cls.id,
        status: "published",
        providerUserId,
      });
      toast.success("Class reactivated");
    } catch {
      toast.error("Failed to reactivate class");
    }
  };

  const renderClassCard = (cls: any, mode: "pending" | "active" | "suspended") => {
    const prov = cls.provider_apartment_registrations?.service_providers;
    const provName = prov?.business_name || prov?.users?.full_name;
    return (
      <Card key={cls.id} className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 flex-shrink-0">
            <BookOpen size={16} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold truncate">{cls.title}</p>
              {cls.requires_common_area === false && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                  <Home size={10} />
                  Home-based
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{provName}</p>
            {cls.class_categories?.name && (
              <Badge variant="outline" className="text-[10px] mt-1">{cls.class_categories.name}</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          {mode === "pending" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs text-destructive border-destructive"
                onClick={() => { setRejectTarget(cls); setRejectReason(""); }}
              >
                <X size={13} className="mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  setApproveTarget(cls);
                  setWithTerms(false);
                  setFeeType("flat");
                  setFeeAmount("");
                  setRevenueSharePct("0");
                  setPaymentFrequency("monthly");
                  setCommercialNotes("");
                }}
              >
                <Check size={13} className="mr-1" /> Approve
              </Button>
            </>
          )}
          {mode === "active" && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-destructive border-destructive"
              onClick={() => { setSuspendTarget(cls); setSuspendReason(""); }}
            >
              <Ban size={13} className="mr-1" /> Suspend
            </Button>
          )}
          {mode === "suspended" && (
            <Button
              size="sm"
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleReactivate(cls)}
              disabled={updateClassStatus.isPending}
            >
              <Play size={13} className="mr-1" /> Reactivate
            </Button>
          )}
        </div>
      </Card>
    );
  };

  const emptyState = (label: string) => (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <BookOpen size={28} className="text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <div ref={ref} className="flex min-h-screen flex-col bg-background pb-20">
      <Header />
      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/dashboard")} className="p-1">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">Class Management</h2>
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="w-full">
            <TabsTrigger value="pending" className="flex-1">
              Pending
              {(pendingClasses?.length ?? 0) > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-[9px] h-4 px-1">
                  {pendingClasses!.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
            <TabsTrigger value="suspended" className="flex-1">Suspended</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {pendingLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
            ) : (pendingClasses?.length ?? 0) > 0 ? (
              <div className="space-y-3">{pendingClasses!.map((c) => renderClassCard(c, "pending"))}</div>
            ) : emptyState("No pending class requests")}
          </TabsContent>

          <TabsContent value="active" className="mt-4">
            {allLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
            ) : activeClasses.length > 0 ? (
              <div className="space-y-3">{activeClasses.map((c) => renderClassCard(c, "active"))}</div>
            ) : emptyState("No active classes")}
          </TabsContent>

          <TabsContent value="suspended" className="mt-4">
            {allLoading ? (
              <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
            ) : suspendedClasses.length > 0 ? (
              <div className="space-y-3">{suspendedClasses.map((c) => renderClassCard(c, "suspended"))}</div>
            ) : emptyState("No suspended classes")}
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Sheet */}
      <Sheet open={!!approveTarget} onOpenChange={() => setApproveTarget(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Approve Class</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Approve <span className="font-semibold text-foreground">{approveTarget?.title}</span>?
            </p>

            {/* Optional commercial terms toggle */}
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Set Commercial Terms</p>
                <p className="text-xs text-muted-foreground">Propose fee arrangement for this class</p>
              </div>
              <Switch checked={withTerms} onCheckedChange={setWithTerms} />
            </div>

            {withTerms && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Fee Type</Label>
                    <Select value={feeType} onValueChange={setFeeType}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat (₹/month)</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{feeType === "percentage" ? "Rate (%)" : "Amount (₹)"}</Label>
                    <Input
                      type="number"
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value)}
                      placeholder={feeType === "percentage" ? "10" : "500"}
                      className="h-10 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Revenue Share %</Label>
                    <Input
                      type="number"
                      value={revenueSharePct}
                      onChange={(e) => setRevenueSharePct(e.target.value)}
                      placeholder="0"
                      className="h-10 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Payment Frequency</Label>
                    <Select value={paymentFrequency} onValueChange={setPaymentFrequency}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Textarea
                    value={commercialNotes}
                    onChange={(e) => setCommercialNotes(e.target.value)}
                    placeholder="Any additional terms..."
                    rows={2}
                    className="rounded-lg"
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleApprove}
              disabled={approveClass.isPending || (withTerms && !feeAmount)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
            >
              {approveClass.isPending ? <Loader2 size={16} className="animate-spin" /> : (
                <>
                  <CheckCircle2 size={16} className="mr-1.5" />
                  {withTerms ? "Approve & Send Terms" : "Approve & Publish"}
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reject Sheet */}
      <Sheet open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Reject Class Request</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Reject <span className="font-semibold text-foreground">{rejectTarget?.title}</span>? The provider will be notified.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectClass.isPending}
              className="w-full bg-destructive hover:bg-destructive/90 text-white rounded-lg"
            >
              {rejectClass.isPending ? <Loader2 size={16} className="animate-spin" /> : "Reject Request"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Suspend Sheet */}
      <Sheet open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Suspend Class</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Suspend <span className="font-semibold text-foreground">{suspendTarget?.title}</span>? This will hide it from residents.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Safety concern, complaint received..."
                rows={3}
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || updateClassStatus.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              {updateClassStatus.isPending ? <Loader2 size={16} className="animate-spin" /> : "Suspend Class"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav persona="admin" />
    </div>
  );
});

AdminClasses.displayName = "AdminClasses";

export default AdminClasses;
