import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { useProviderRegistrations } from "@/hooks/useProvider";
import {
  useProviderRevenue,
  useProviderStudentAnalytics,
  useProviderAttendanceAnalytics,
  useProviderCollectionAnalytics,
} from "@/hooks/useAnalytics";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  DollarSign,
  Download,
  IndianRupee,
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
  const { profile, providerProfile } = useUser();
  const [tab, setTab] = useState("revenue");

  const { data: registrations } = useProviderRegistrations(providerProfile?.id);
  const regIds = registrations?.filter((r) => r.status === "approved").map((r) => r.id) ?? [];

  const { data: revenue, isLoading: revenueLoading } = useProviderRevenue(providerProfile?.id);
  const { data: students, isLoading: studentsLoading } = useProviderStudentAnalytics(providerProfile?.id, regIds);
  const { data: attendance, isLoading: attendanceLoading } = useProviderAttendanceAnalytics(providerProfile?.id, regIds);
  const { data: collection, isLoading: collectionLoading } = useProviderCollectionAnalytics(providerProfile?.id);

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
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="revenue" className="text-xs px-1">Revenue</TabsTrigger>
            <TabsTrigger value="students" className="text-xs px-1">Students</TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs px-1">Attendance</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs px-1">Payments</TabsTrigger>
          </TabsList>

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
