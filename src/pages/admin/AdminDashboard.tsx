import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useAdminStats,
  useAdminProviderRegistrations,
  useTopClassesByEnrollment,
  useApproveProvider,
  useRejectProvider,
} from "@/hooks/useAdmin";
import { useAdminFeaturedRequests } from "@/hooks/useFeatured";
import { useCategories } from "@/hooks/useClasses";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  BookOpen,
  Check,
  GraduationCap,
  Loader2,
  Sparkles,
  Users,
  Home as HomeIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const STAT_COLORS = ["#F59E0B", "#6366F1", "#059669", "#EC4899"];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile, currentApartment } = useUser();
  const aptId = currentApartment?.id;

  const { data: stats, isLoading: statsLoading } = useAdminStats(aptId);
  const { data: pendingRegs } = useAdminProviderRegistrations(aptId, "pending");
  const { data: topClasses } = useTopClassesByEnrollment(aptId);
  const { data: featuredRequests } = useAdminFeaturedRequests(aptId);
  const { data: allCategories } = useCategories();
  const pendingFeaturedCount = featuredRequests?.filter((r) => r.status === "pending_approval").length ?? 0;

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

  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [feeType, setFeeType] = useState("flat");
  const [feeAmount, setFeeAmount] = useState("0");
  const [minGuaranteedFee, setMinGuaranteedFee] = useState("0");
  const [revenueSharePct, setRevenueSharePct] = useState("0");
  const [paymentFrequency, setPaymentFrequency] = useState("monthly");
  const [freeTrialDays, setFreeTrialDays] = useState("0");
  const [commercialNotes, setCommercialNotes] = useState("");

  const handleApprove = async () => {
    if (!selectedReg || !profile) return;
    try {
      await approveProvider.mutateAsync({
        registrationId: selectedReg.id,
        approvedBy: profile.id,
        feeType,
        feeAmount: parseFloat(feeAmount) || 0,
        minGuaranteedFee: parseFloat(minGuaranteedFee) || 0,
        revenueSharePct: parseFloat(revenueSharePct) || 0,
        paymentFrequency,
        freeTrialDays: parseInt(freeTrialDays) || 0,
        commercialNotes: commercialNotes || undefined,
      });
      toast.success("Provider approved");
      setSelectedReg(null);
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (regId: string) => {
    try {
      await rejectProvider.mutateAsync({ registrationId: regId });
      toast.success("Provider rejected");
    } catch {
      toast.error("Failed to reject");
    }
  };

  const statCards = [
    { label: "Families", value: stats?.families ?? 0, icon: HomeIcon },
    { label: "Providers", value: stats?.providers ?? 0, icon: GraduationCap },
    { label: "Classes", value: stats?.classes ?? 0, icon: BookOpen },
    { label: "Enrollments", value: stats?.enrollments ?? 0, icon: Users },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-6">
        <h2 className="text-lg font-bold">Admin Dashboard</h2>
        {currentApartment && (
          <p className="text-xs text-muted-foreground -mt-4">{currentApartment.name}</p>
        )}

        {/* Stats */}
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((s, i) => (
              <Card key={s.label} className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: STAT_COLORS[i] + "20" }}
                  >
                    <s.icon size={16} style={{ color: STAT_COLORS[i] }} />
                  </div>
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Provider Approval Queue */}
        {pendingRegs && pendingRegs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Pending Approvals</h3>
              <Badge variant="destructive" className="text-xs">{pendingRegs.length}</Badge>
            </div>
            <div className="space-y-2">
              {pendingRegs.map((reg) => {
                const prov = reg.service_providers as any;
                const user = prov?.users;
                return (
                  <Card key={reg.id} className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user?.avatar_url} />
                        <AvatarFallback className="bg-provider/10 text-provider text-xs">
                          {user?.full_name?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {prov?.business_name || user?.full_name}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-[9px] capitalize">
                            {prov?.provider_type}
                          </Badge>
                          {prov?.experience_years && <span>{prov.experience_years} yrs</span>}
                        </div>
                      </div>
                    </div>
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
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs text-destructive border-destructive"
                        onClick={() => handleReject(reg.id)}
                      >
                        <X size={14} className="mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                          setSelectedReg(reg);
                          setFeeType("flat");
                          setFeeAmount("0");
                          setMinGuaranteedFee("0");
                          setRevenueSharePct("0");
                          setPaymentFrequency("monthly");
                          setFreeTrialDays("0");
                          setCommercialNotes("");
                        }}
                      >
                        <Check size={14} className="mr-1" /> Approve
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3">
          <Card
            className="p-4 cursor-pointer hover:shadow-md transition-all text-center"
            onClick={() => navigate("/admin/providers")}
          >
            <Users size={20} className="mx-auto text-provider mb-1" />
            <p className="text-xs font-semibold">Providers</p>
          </Card>
          <Card
            className="p-4 cursor-pointer hover:shadow-md transition-all text-center relative"
            onClick={() => navigate("/admin/featured")}
          >
            <Sparkles size={20} className="mx-auto text-amber-500 mb-1" />
            <p className="text-xs font-semibold">Featured</p>
            {pendingFeaturedCount > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 text-[9px] h-5 min-w-5 px-1">
                {pendingFeaturedCount}
              </Badge>
            )}
          </Card>
          <Card
            className="p-4 cursor-pointer hover:shadow-md transition-all text-center"
            onClick={() => navigate("/admin/reports")}
          >
            <BookOpen size={20} className="mx-auto text-emerald-600 mb-1" />
            <p className="text-xs font-semibold">Reports</p>
          </Card>
        </div>

        {/* Top Classes by Enrollment */}
        {topClasses && topClasses.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-3">Top Classes by Enrollment</h3>
            <Card className="p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topClasses} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="title"
                    width={100}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} students`, "Enrollments"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="enrollments" radius={[0, 4, 4, 0]}>
                    {topClasses.map((_: any, i: number) => (
                      <Cell key={i} fill={STAT_COLORS[i % STAT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}
      </div>

      {/* Approve Sheet */}
      <Sheet open={!!selectedReg} onOpenChange={() => setSelectedReg(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Set Commission Terms</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Set commercial terms for{" "}
              <span className="font-semibold text-foreground">
                {(selectedReg?.service_providers as any)?.business_name ||
                  (selectedReg?.service_providers as any)?.users?.full_name}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fee Type</Label>
                <Select value={feeType} onValueChange={setFeeType}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat (₹/month)</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  {feeType === "percentage" ? "Rate (%)" : "Amount (₹)"}
                </Label>
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
                <Label className="text-xs">Revenue Share (%)</Label>
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
              <Label className="text-xs">Notes (optional)</Label>
              <Input
                value={commercialNotes}
                onChange={(e) => setCommercialNotes(e.target.value)}
                placeholder="Any additional terms or notes..."
                className="h-10 rounded-lg"
              />
            </div>
            <Button
              onClick={handleApprove}
              disabled={approveProvider.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
            >
              {approveProvider.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Approve Provider"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav persona="admin" />
    </div>
  );
};

export default AdminDashboard;
