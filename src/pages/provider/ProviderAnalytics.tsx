import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { useProviderRegistrations } from "@/hooks/useProvider";
import {
  useProviderRevenue,
  useProviderStudentAnalytics,
  useProviderAttendanceAnalytics,
  useProviderCollectionAnalytics,
} from "@/hooks/useAnalytics";
import { useCompetitorClasses, useEnrollmentGrowth } from "@/hooks/useSubscription";
import PremiumGate from "@/components/subscription/PremiumGate";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  BadgeCheck,
  Crown,
  DollarSign,
  Download,
  IndianRupee,
  MapPin,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

const ProviderAnalytics = () => {
  const { profile, providerProfile, isPremium } = useUser();
  const [tab, setTab] = useState("revenue");

  const { data: registrations } = useProviderRegistrations(providerProfile?.id);
  const regIds = registrations?.filter((r) => r.status === "approved").map((r) => r.id) ?? [];

  const { data: revenue, isLoading: revenueLoading } = useProviderRevenue(providerProfile?.id);
  const { data: students, isLoading: studentsLoading } = useProviderStudentAnalytics(providerProfile?.id, regIds);
  const { data: attendance, isLoading: attendanceLoading } = useProviderAttendanceAnalytics(providerProfile?.id, regIds);
  const { data: collection, isLoading: collectionLoading } = useProviderCollectionAnalytics(providerProfile?.id);

  // Premium-only data
  const categoryIds = providerProfile?.specialization_category_ids ?? [];
  const { data: competitors, isLoading: competitorsLoading } = useCompetitorClasses(
    providerProfile?.id,
    categoryIds
  );
  const { data: growth, isLoading: growthLoading } = useEnrollmentGrowth(providerProfile?.id);

  const exportCSV = () => {
    if (!collection) return;
    const rows = [["Member", "Relationship", "Amount", "Due Date"]];
    for (const item of collection.overdueList) {
      rows.push([item.memberName, item.relationship, `${item.amount}`, item.dueDate ?? ""]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "overdue-payments.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />
      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 size={20} className="text-indigo-500" /> Analytics
        </h2>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
            <TabsList className="flex min-w-max gap-0.5">
              <TabsTrigger value="revenue"    className="text-xs px-3 shrink-0">Revenue</TabsTrigger>
              <TabsTrigger value="students"   className="text-xs px-3 shrink-0">Students</TabsTrigger>
              <TabsTrigger value="attendance" className="text-xs px-3 shrink-0">Attendance</TabsTrigger>
              <TabsTrigger value="payments"   className="text-xs px-3 shrink-0">Payments</TabsTrigger>
              <TabsTrigger value="competitors" className="text-xs px-3 shrink-0 gap-1">
                <Crown size={11} className="text-amber-500" />
                Competitors
              </TabsTrigger>
              <TabsTrigger value="growth" className="text-xs px-3 shrink-0 gap-1">
                <Crown size={11} className="text-amber-500" />
                Growth
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="mt-4 space-y-4">
            {revenueLoading ? (
              <LoadingSkeleton />
            ) : revenue ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Total Revenue"
                    value={`₹${revenue.totalRevenue.toLocaleString("en-IN")}`}
                    icon={<IndianRupee size={16} className="text-green-600" />}
                    color="bg-green-50"
                  />
                  <StatCard
                    label="Avg / Month"
                    value={`₹${Math.round(revenue.avgPerMonth).toLocaleString("en-IN")}`}
                    icon={<TrendingUp size={16} className="text-blue-600" />}
                    color="bg-blue-50"
                  />
                </div>

                <Card className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">Monthly Revenue</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={revenue.monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={40} />
                      <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                      <Bar dataKey="revenue" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Revenue by Class</p>
                  {revenue.revenueByClass.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No revenue data yet</p>
                  ) : (
                    revenue.revenueByClass.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <span className="text-sm truncate flex-1">{c.title}</span>
                        <span className="text-sm font-semibold">₹{c.revenue.toLocaleString("en-IN")}</span>
                      </div>
                    ))
                  )}
                </Card>
              </>
            ) : null}
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students" className="mt-4 space-y-4">
            {studentsLoading ? (
              <LoadingSkeleton />
            ) : students ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Active Students"
                    value={String(students.totalStudents)}
                    icon={<Users size={16} className="text-indigo-600" />}
                    color="bg-indigo-50"
                  />
                  <StatCard
                    label="New This Month"
                    value={String(students.newThisMonth)}
                    icon={<TrendingUp size={16} className="text-green-600" />}
                    color="bg-green-50"
                  />
                </div>

                <Card className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">Enrollment Trend</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={students.enrollmentTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Card className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Students by Class</p>
                  {students.byClass.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No students yet</p>
                  ) : (
                    students.byClass.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <span className="text-sm truncate flex-1">{c.title}</span>
                        <Badge variant="secondary" className="text-xs">{c.count}</Badge>
                      </div>
                    ))
                  )}
                </Card>
              </>
            ) : null}
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="mt-4 space-y-4">
            {attendanceLoading ? (
              <LoadingSkeleton />
            ) : attendance ? (
              <>
                <StatCard
                  label="Average Attendance Rate"
                  value={`${attendance.averageRate}%`}
                  icon={<Calendar size={16} className="text-blue-600" />}
                  color="bg-blue-50"
                />

                <Card className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">Attendance by Batch</p>
                  {attendance.byBatch.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No attendance data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(120, attendance.byBatch.length * 40)}>
                      <BarChart data={attendance.byBatch} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                        <YAxis dataKey="batchName" type="category" tick={{ fontSize: 10 }} width={80} />
                        <Tooltip formatter={(v: number) => [`${v}%`, "Attendance"]} />
                        <Bar dataKey="rate" fill="#22C55E" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                {attendance.lowAttendance.length > 0 && (
                  <Card className="p-4 border-amber-200 bg-amber-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={14} className="text-amber-600" />
                      <p className="text-xs font-semibold text-amber-800">
                        Low Attendance Alerts ({attendance.lowAttendance.length})
                      </p>
                    </div>
                    <p className="text-xs text-amber-700">
                      {attendance.lowAttendance.length} student(s) below 50% attendance rate
                    </p>
                  </Card>
                )}
              </>
            ) : null}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="mt-4 space-y-4">
            {collectionLoading ? (
              <LoadingSkeleton />
            ) : collection ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Collection Rate"
                    value={`${collection.collectionRate}%`}
                    icon={<DollarSign size={16} className="text-green-600" />}
                    color="bg-green-50"
                  />
                  <StatCard
                    label="Pending"
                    value={`₹${collection.pendingAmount.toLocaleString("en-IN")}`}
                    icon={<IndianRupee size={16} className="text-amber-600" />}
                    color="bg-amber-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Total Collected"
                    value={`₹${collection.totalCollected.toLocaleString("en-IN")}`}
                    icon={<IndianRupee size={16} className="text-green-600" />}
                    color="bg-green-50"
                  />
                  <StatCard
                    label="Overdue"
                    value={`₹${collection.overdueAmount.toLocaleString("en-IN")}`}
                    icon={<AlertTriangle size={16} className="text-red-600" />}
                    color="bg-red-50"
                  />
                </div>

                {collection.overdueList.length > 0 && (
                  <Card className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground">Overdue Payments</p>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={exportCSV}>
                        <Download size={12} /> CSV
                      </Button>
                    </div>
                    {collection.overdueList.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{item.memberName}</p>
                          <p className="text-[10px] text-muted-foreground">{item.relationship} · Due: {item.dueDate}</p>
                        </div>
                        <span className="text-sm font-semibold text-red-600">₹{item.amount}</span>
                      </div>
                    ))}
                  </Card>
                )}
              </>
            ) : null}
          </TabsContent>
          {/* Competitors Tab ─────────────────────────────────────────────── */}
          <TabsContent value="competitors" className="mt-4 space-y-4">
            <PremiumGate
              featureName="Competitor Analysis"
              featureDescription="See who else offers similar classes nearby and compare"
            >
              {competitorsLoading ? (
                <LoadingSkeleton />
              ) : competitors && competitors.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Target size={16} className="text-indigo-500" />
                    <p className="text-sm font-semibold">
                      {competitors.length} competitors in your categories
                    </p>
                  </div>
                  <Card className="divide-y">
                    {competitors.map((c) => {
                      const provider = c.service_providers;
                      return (
                        <div key={c.id} className="flex items-center gap-3 p-3">
                          <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                            <Store size={14} className="text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.title}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">
                                {provider?.business_name}
                              </span>
                              {provider?.is_verified && (
                                <BadgeCheck size={10} className="text-blue-500" />
                              )}
                              {provider?.subscription_tier === "premium" && (
                                <Crown size={10} className="text-amber-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                </>
              ) : (
                <div className="flex flex-col items-center py-12 gap-3 text-center">
                  <Target size={36} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No competitors found in your categories yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Add specialisation categories to your provider profile to see competitors
                  </p>
                </div>
              )}
            </PremiumGate>
          </TabsContent>

          {/* Growth Insights Tab ──────────────────────────────────────────── */}
          <TabsContent value="growth" className="mt-4 space-y-4">
            <PremiumGate
              featureName="Growth Insights"
              featureDescription="Track enrollment trends and month-over-month growth"
            >
              {growthLoading ? (
                <LoadingSkeleton />
              ) : growth ? (
                <>
                  {/* Growth rate headline */}
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard
                      label="MoM Growth"
                      value={
                        growth.growthRate !== null
                          ? `${growth.growthRate > 0 ? "+" : ""}${growth.growthRate}%`
                          : "—"
                      }
                      icon={
                        growth.growthRate !== null && growth.growthRate >= 0 ? (
                          <TrendingUp size={16} className="text-green-600" />
                        ) : (
                          <TrendingDown size={16} className="text-red-500" />
                        )
                      }
                      color={
                        growth.growthRate !== null && growth.growthRate >= 0
                          ? "bg-green-50"
                          : "bg-red-50"
                      }
                    />
                    <StatCard
                      label="This Month"
                      value={String(growth.trend[growth.trend.length - 1]?.count ?? 0)}
                      icon={<Users size={16} className="text-indigo-600" />}
                      color="bg-indigo-50"
                    />
                  </div>

                  <Card className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">
                      Enrollment Trend (6 months)
                    </p>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={growth.trend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Growth tip */}
                  <Card className="p-4 border-amber-200 bg-amber-50/40">
                    <div className="flex items-start gap-2">
                      <TrendingUp size={14} className="text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-900 mb-0.5">
                          Growth Tip
                        </p>
                        <p className="text-xs text-amber-700">
                          {growth.growthRate !== null && growth.growthRate > 10
                            ? "Great momentum! Consider sponsoring your top class to accelerate further."
                            : growth.growthRate !== null && growth.growthRate < 0
                            ? "Enrollments declined this month. Try offering a free trial session to attract new students."
                            : "Steady growth. Consistent class quality and timely follow-ups with leads drive sustained growth."}
                        </p>
                      </div>
                    </div>
                  </Card>
                </>
              ) : null}
            </PremiumGate>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav persona="provider" />
    </div>
  );
};

const StatCard = ({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) => (
  <Card className="p-3">
    <div className="flex items-center gap-2 mb-1">
      <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
    </div>
    <p className="text-lg font-bold">{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </Card>
);

const LoadingSkeleton = () => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
    </div>
    <Skeleton className="h-48 rounded-xl" />
    <Skeleton className="h-32 rounded-xl" />
  </div>
);

export default ProviderAnalytics;
