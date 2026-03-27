import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useAdminFeePayments, useAdminProviderRegistrations, useConfirmFeePaid } from "@/hooks/useAdmin";
import { useAdminFeaturedRequests } from "@/hooks/useFeatured";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  FileBarChart,
  Loader2,
  Star,
} from "lucide-react";
import { toast } from "sonner";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FEE_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  waived: "bg-gray-100 text-gray-600",
  disputed: "bg-red-100 text-red-700",
};

const AdminReports = () => {
  const navigate = useNavigate();
  const { currentApartment } = useUser();
  const aptId = currentApartment?.id;

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { data: feePayments, isLoading: feesLoading } = useAdminFeePayments(aptId, selectedMonth, selectedYear);
  const { data: providers } = useAdminProviderRegistrations(aptId, "approved");
  const { data: featuredRequests } = useAdminFeaturedRequests(aptId);
  const confirmFee = useConfirmFeePaid();

  // Featured ad fees - filter by status (accepted/active have paid fees)
  const featuredWithFees = (featuredRequests ?? []).filter((f) => f.ad_fee && f.ad_fee > 0);
  const totalAdFees = featuredWithFees
    .filter((f) => f.fee_status === "accepted" || f.status === "active")
    .reduce((sum, f) => sum + (f.ad_fee ?? 0), 0);
  const pendingAdFees = featuredWithFees
    .filter((f) => f.fee_status === "fee_proposed")
    .reduce((sum, f) => sum + (f.ad_fee ?? 0), 0);

  const handleConfirm = async (feeId: string) => {
    try {
      await confirmFee.mutateAsync(feeId);
      toast.success("Payment confirmed");
    } catch {
      toast.error("Failed to confirm");
    }
  };

  // Build provider revenue summary from fee payments
  const providerSummary = providers?.map((reg) => {
    const prov = reg.service_providers as any;
    const feeRecord = feePayments?.find((fp) => (fp.provider_apartment_registrations as any)?.id === reg.id);
    return {
      regId: reg.id,
      name: prov?.business_name || prov?.users?.full_name || "Provider",
      feeType: reg.admin_fee_type,
      feeAmount: reg.admin_fee_amount,
      feeRecord,
    };
  }) ?? [];

  const totalDue = providerSummary.reduce((sum, p) => sum + (p.feeRecord?.amount ?? 0), 0);
  const totalPaid = providerSummary
    .filter((p) => p.feeRecord?.status === "confirmed" || p.feeRecord?.status === "paid")
    .reduce((sum, p) => sum + (p.feeRecord?.amount ?? 0), 0);

  const handleExportCSV = () => {
    if (!providerSummary.length) return;
    const headers = "Provider,Fee Type,Fee Rate,Revenue,Commission Due,Status\n";
    const rows = providerSummary.map((p) =>
      [
        p.name,
        p.feeType ?? "N/A",
        p.feeAmount ?? 0,
        p.feeRecord?.total_provider_revenue ?? 0,
        p.feeRecord?.amount ?? 0,
        p.feeRecord?.status ?? "N/A",
      ].join(",")
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-report-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  // Generate years list
  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/dashboard")} className="p-1">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">Fee Reports</h2>
        </div>

        {/* Month/Year picker */}
        <div className="flex gap-3">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="flex-1 h-10 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24 h-10 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Due</p>
            <p className="text-xl font-bold">₹{totalDue.toLocaleString("en-IN")}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Collected</p>
            <p className="text-xl font-bold text-green-600">₹{totalPaid.toLocaleString("en-IN")}</p>
          </Card>
        </div>

        {/* Provider-wise breakdown */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Provider Breakdown</h3>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={handleExportCSV}
              disabled={!providerSummary.length}
            >
              <Download size={14} className="mr-1" /> CSV
            </Button>
          </div>

          {feesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : providerSummary.length > 0 ? (
            <div className="space-y-2">
              {providerSummary.map((p) => (
                <Card key={p.regId} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{p.name}</p>
                    {p.feeRecord ? (
                      <Badge className={`text-[10px] border-0 ${FEE_STATUS_COLORS[p.feeRecord.status ?? ""] ?? "bg-gray-100"}`}>
                        {p.feeRecord.status}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">No record</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Fee</p>
                      <p className="font-medium">
                        {p.feeType === "flat" ? `₹${p.feeAmount}/mo` : p.feeType === "percentage" ? `${p.feeAmount}%` : "N/A"}
                      </p>
                    </div>
                    {p.feeRecord && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-medium">₹{p.feeRecord.total_provider_revenue ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Due</p>
                          <p className="font-medium">₹{p.feeRecord.amount}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {p.feeRecord && p.feeRecord.status === "paid" && (
                    <Button
                      size="sm"
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                      onClick={() => handleConfirm(p.feeRecord!.id)}
                      disabled={confirmFee.isPending}
                    >
                      {confirmFee.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <><CheckCircle size={14} className="mr-1" /> Confirm Payment</>
                      )}
                    </Button>
                  )}

                  {p.feeRecord && p.feeRecord.status === "pending" && (
                    <div className="flex items-center gap-1 text-xs text-amber-600">
                      <Clock size={12} /> Payment pending
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <FileBarChart size={28} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No fee records for this period</p>
              <p className="text-xs text-muted-foreground">
                Fee records are created when providers make payments
              </p>
            </div>
          )}
        </div>

        {/* Featured Ad Fees Section */}
        <div>
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Star size={14} className="text-purple-500" /> Featured Ad Fees
          </h3>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Card className="p-3">
              <p className="text-[10px] text-muted-foreground">Collected</p>
              <p className="text-lg font-bold text-purple-600">₹{totalAdFees.toLocaleString("en-IN")}</p>
            </Card>
            <Card className="p-3">
              <p className="text-[10px] text-muted-foreground">Pending Acceptance</p>
              <p className="text-lg font-bold text-amber-600">₹{pendingAdFees.toLocaleString("en-IN")}</p>
            </Card>
          </div>

          {featuredWithFees.length > 0 ? (
            <div className="space-y-2">
              {featuredWithFees.map((f) => {
                const provReg = f.provider_apartment_registrations as any;
                const provName = provReg?.service_providers?.business_name || provReg?.service_providers?.users?.full_name || "Provider";
                const className = (f.classes as any)?.title || "Class";
                const statusColor = f.fee_status === "accepted" || f.status === "active"
                  ? "bg-green-100 text-green-700"
                  : f.fee_status === "fee_proposed"
                  ? "bg-amber-100 text-amber-700"
                  : f.fee_status === "rejected"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-600";

                return (
                  <Card key={f.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold truncate">{className}</p>
                      <Badge className={`text-[10px] border-0 ${statusColor}`}>
                        {f.fee_status === "accepted" ? "Paid" : f.fee_status ?? f.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{provName}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-purple-700">₹{f.ad_fee}</span>
                      {f.valid_from && f.valid_until && (
                        <span className="text-muted-foreground">
                          {new Date(f.valid_from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {" — "}
                          {new Date(f.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Star size={24} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No featured ad fees yet</p>
            </div>
          )}
        </div>
      </div>

      <BottomNav persona="admin" />
    </div>
  );
};

export default AdminReports;
