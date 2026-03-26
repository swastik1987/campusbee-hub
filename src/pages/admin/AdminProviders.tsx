import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useAdminProviderRegistrations,
  useApproveProvider,
  useRejectProvider,
  useSuspendProvider,
  useReinstateProvider,
} from "@/hooks/useAdmin";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Check,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Users,
  X,
} from "lucide-react";
import { useCategories } from "@/hooks/useClasses";
import { toast } from "sonner";

const AdminProviders = () => {
  const navigate = useNavigate();
  const { profile, currentApartment } = useUser();
  const aptId = currentApartment?.id;

  const [tab, setTab] = useState("active");
  const { data: registrations, isLoading } = useAdminProviderRegistrations(aptId, tab === "active" ? "approved" : tab);
  const { data: allCategories } = useCategories();

  const getCategoryNames = (ids: string[] | null): string[] => {
    if (!ids || !allCategories) return [];
    return ids
      .map((id) => {
        const cat = allCategories.find((c) => c.id === id);
        if (!cat) return null;
        const parent = cat.parent_category_id
          ? allCategories.find((p) => p.id === cat.parent_category_id)
          : null;
        return parent ? `${parent.name} › ${cat.name}` : cat.name;
      })
      .filter(Boolean) as string[];
  };

  const approveProvider = useApproveProvider();
  const rejectProvider = useRejectProvider();
  const suspendProvider = useSuspendProvider();
  const reinstateProvider = useReinstateProvider();

  // Sheet states
  const [detailReg, setDetailReg] = useState<any>(null);
  const [approveSheet, setApproveSheet] = useState<any>(null);
  const [suspendSheet, setSuspendSheet] = useState<any>(null);
  const [rejectSheet, setRejectSheet] = useState<any>(null);

  // Approval form states
  const [feeType, setFeeType] = useState("flat");
  const [feeAmount, setFeeAmount] = useState("0");
  const [minGuaranteedFee, setMinGuaranteedFee] = useState("0");
  const [revenueSharePct, setRevenueSharePct] = useState("0");
  const [paymentFrequency, setPaymentFrequency] = useState("monthly");
  const [freeTrialDays, setFreeTrialDays] = useState("0");
  const [commercialNotes, setCommercialNotes] = useState("");

  // Suspend / Reject states
  const [suspendReason, setSuspendReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const resetApproveForm = () => {
    setFeeType("flat");
    setFeeAmount("0");
    setMinGuaranteedFee("0");
    setRevenueSharePct("0");
    setPaymentFrequency("monthly");
    setFreeTrialDays("0");
    setCommercialNotes("");
  };

  const handleApprove = async () => {
    if (!approveSheet || !profile) return;
    try {
      await approveProvider.mutateAsync({
        registrationId: approveSheet.id,
        approvedBy: profile.id,
        feeType,
        feeAmount: parseFloat(feeAmount) || 0,
        minGuaranteedFee: parseFloat(minGuaranteedFee) || 0,
        revenueSharePct: parseFloat(revenueSharePct) || 0,
        paymentFrequency,
        freeTrialDays: parseInt(freeTrialDays, 10) || 0,
        commercialNotes: commercialNotes.trim() || undefined,
      });
      toast.success("Provider approved");
      setApproveSheet(null);
      resetApproveForm();
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!rejectSheet) return;
    try {
      await rejectProvider.mutateAsync({
        registrationId: rejectSheet.id,
        reason: rejectReason.trim() || undefined,
      });
      toast.success("Provider rejected");
      setRejectSheet(null);
      setRejectReason("");
    } catch {
      toast.error("Failed to reject");
    }
  };

  const handleSuspend = async () => {
    if (!suspendSheet || !suspendReason.trim()) return;
    try {
      await suspendProvider.mutateAsync({
        registrationId: suspendSheet.id,
        reason: suspendReason.trim(),
      });
      toast.success("Provider suspended");
      setSuspendSheet(null);
      setSuspendReason("");
    } catch {
      toast.error("Failed to suspend");
    }
  };

  const handleReinstate = async (regId: string) => {
    try {
      await reinstateProvider.mutateAsync(regId);
      toast.success("Provider reinstated");
    } catch {
      toast.error("Failed to reinstate");
    }
  };

  const renderTermsStatusBadge = (reg: any) => {
    if (reg.status !== "approved") return null;
    if (reg.terms_status === "accepted") return null;

    if (reg.terms_status === "rejected") {
      return (
        <Badge variant="destructive" className="text-[9px] h-4 px-1">
          Terms Rejected
        </Badge>
      );
    }

    // pending / not yet accepted
    return (
      <Badge className="text-[9px] h-4 px-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
        Awaiting Acceptance
      </Badge>
    );
  };

  const renderProviderCard = (reg: any) => {
    const prov = reg.service_providers as any;
    const user = prov?.users;
    return (
      <Card
        key={reg.id}
        className="p-4 space-y-3 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(`/admin/providers/${reg.id}`)}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-provider/10 text-provider text-xs">
              {user?.full_name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold truncate">
                {prov?.business_name || user?.full_name}
              </p>
              {prov?.is_verified && <CheckCircle2 size={12} className="text-blue-500 flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[9px] capitalize">{prov?.provider_type}</Badge>
              {prov?.experience_years && <span>{prov.experience_years} yrs</span>}
              {user?.email && <span className="truncate">· {user.email}</span>}
            </div>
          </div>
        </div>

        {/* Terms status badge */}
        {renderTermsStatusBadge(reg)}

        {(() => {
          const catNames = getCategoryNames(prov?.specialization_category_ids);
          const display = catNames.length > 0 ? catNames : (prov?.specializations ?? []);
          return display.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {display.slice(0, 6).map((s: string) => (
                <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
              ))}
              {display.length > 6 && (
                <Badge variant="outline" className="text-[10px]">+{display.length - 6} more</Badge>
              )}
            </div>
          ) : null;
        })()}

        {/* Fee info for approved */}
        {reg.status === "approved" && reg.admin_fee_type && (
          <p className="text-xs text-muted-foreground">
            Commission: {reg.admin_fee_type === "flat" ? `₹${reg.admin_fee_amount}/mo` : `${reg.admin_fee_amount}%`}
          </p>
        )}

        {/* Suspension reason */}
        {reg.status === "suspended" && reg.suspension_reason && (
          <p className="text-xs text-red-600">
            Suspended: {reg.suspension_reason}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {reg.status === "pending" && (
            <>
              <Button
                size="sm" variant="outline"
                className="flex-1 text-xs text-destructive border-destructive"
                onClick={() => { setRejectSheet(reg); setRejectReason(""); }}
              >
                <X size={14} className="mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => { setApproveSheet(reg); resetApproveForm(); }}
              >
                <Check size={14} className="mr-1" /> Approve
              </Button>
            </>
          )}
          {reg.status === "approved" && (
            <Button
              size="sm" variant="outline"
              className="text-xs text-destructive border-destructive"
              onClick={() => { setSuspendSheet(reg); setSuspendReason(""); }}
            >
              <Ban size={14} className="mr-1" /> Suspend
            </Button>
          )}
          {reg.status === "suspended" && (
            <Button
              size="sm"
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleReinstate(reg.id)}
            >
              <RotateCcw size={14} className="mr-1" /> Reinstate
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/dashboard")} className="p-1">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">Provider Management</h2>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">
              Pending
              {tab !== "pending" && registrations && (
                <Badge variant="destructive" className="ml-1 text-[9px] h-4 px-1">
                  {registrations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suspended" className="flex-1">Suspended</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : registrations && registrations.length > 0 ? (
              <div className="space-y-3">
                {registrations.map(renderProviderCard)}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Users size={28} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {tab === "pending"
                    ? "No pending applications"
                    : tab === "suspended"
                    ? "No suspended providers"
                    : "No active providers"}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Sheet */}
      <Sheet open={!!approveSheet} onOpenChange={() => setApproveSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Set Commission Terms</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Set commission for{" "}
              <span className="font-semibold text-foreground">
                {(approveSheet?.service_providers as any)?.business_name ||
                  (approveSheet?.service_providers as any)?.users?.full_name}
              </span>
            </p>

            {/* Base fee fields */}
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
                <Label className="text-xs">{feeType === "flat" ? "Amount (₹)" : "Rate (%)"}</Label>
                <Input
                  type="number"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>
            </div>

            {/* Enhanced commercial terms */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Min Guaranteed Fee (₹)</Label>
                <Input
                  type="number"
                  value={minGuaranteedFee}
                  onChange={(e) => setMinGuaranteedFee(e.target.value)}
                  placeholder="0"
                  className="h-10 rounded-lg"
                />
              </div>
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
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1">
                <Label className="text-xs">Free Trial Days</Label>
                <Input
                  type="number"
                  value={freeTrialDays}
                  onChange={(e) => setFreeTrialDays(e.target.value)}
                  placeholder="0"
                  className="h-10 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Commercial Notes</Label>
              <Textarea
                value={commercialNotes}
                onChange={(e) => setCommercialNotes(e.target.value)}
                placeholder="Any additional terms or notes..."
                rows={2}
                className="rounded-lg"
              />
            </div>

            <Button
              onClick={handleApprove}
              disabled={approveProvider.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
            >
              {approveProvider.isPending ? <Loader2 size={16} className="animate-spin" /> : "Approve Provider"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reject Sheet */}
      <Sheet open={!!rejectSheet} onOpenChange={() => setRejectSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Reject Provider</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Reject application from{" "}
              <span className="font-semibold text-foreground">
                {(rejectSheet?.service_providers as any)?.business_name ||
                  (rejectSheet?.service_providers as any)?.users?.full_name}
              </span>
              ?
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Reason (optional)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                rows={2}
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleReject}
              disabled={rejectProvider.isPending}
              className="w-full bg-destructive hover:bg-destructive/90 text-white rounded-lg"
            >
              {rejectProvider.isPending ? <Loader2 size={16} className="animate-spin" /> : "Reject Provider"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Suspend Sheet */}
      <Sheet open={!!suspendSheet} onOpenChange={() => setSuspendSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Suspend Provider</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Suspend{" "}
              <span className="font-semibold text-foreground">
                {(suspendSheet?.service_providers as any)?.business_name ||
                  (suspendSheet?.service_providers as any)?.users?.full_name}
              </span>
              ? This will hide their classes.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason for suspension..."
                rows={2}
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || suspendProvider.isPending}
              className="w-full bg-destructive hover:bg-destructive/90 text-white rounded-lg"
            >
              {suspendProvider.isPending ? <Loader2 size={16} className="animate-spin" /> : "Suspend Provider"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav persona="admin" />
    </div>
  );
};

export default AdminProviders;
