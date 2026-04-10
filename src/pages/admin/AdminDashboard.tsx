import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useAdminStats,
  useAdminPendingClasses,
  useTopClassesByEnrollment,
} from "@/hooks/useAdmin";
import { useAdminFeaturedRequests } from "@/hooks/useFeatured";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  GraduationCap,
  Sparkles,
  Users,
  Home as HomeIcon,
  AlertCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const STAT_COLORS = ["#F59E0B", "#6366F1", "#059669", "#EC4899"];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { currentApartment } = useUser();
  const aptId = currentApartment?.id;

  const { data: stats, isLoading: statsLoading } = useAdminStats(aptId);
  const { data: pendingClasses } = useAdminPendingClasses(aptId);
  const { data: topClasses } = useTopClassesByEnrollment(aptId);
  const { data: featuredRequests } = useAdminFeaturedRequests(aptId);
  const pendingFeaturedCount = featuredRequests?.filter((r) => r.status === "pending_approval").length ?? 0;

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

        {/* Pending Class Review Queue */}
        {pendingClasses && pendingClasses.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500" />
                Pending Class Reviews
              </h3>
              <Badge variant="destructive" className="text-xs">{pendingClasses.length}</Badge>
            </div>
            <div className="space-y-2">
              {pendingClasses.slice(0, 3).map((cls: any) => {
                const prov = cls.provider_apartment_registrations?.service_providers as any;
                return (
                  <Card
                    key={cls.id}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate("/admin/classes")}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                      <BookOpen size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cls.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {prov?.business_name || prov?.users?.full_name}
                      </p>
                    </div>
                    <Badge className="text-[9px] bg-blue-100 text-blue-700 hover:bg-blue-100">Review</Badge>
                  </Card>
                );
              })}
              {pendingClasses.length > 3 && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate("/admin/classes")}>
                  View all {pendingClasses.length} pending
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-4 gap-3">
          <Card
            className="p-4 cursor-pointer hover:shadow-md transition-all text-center"
            onClick={() => navigate("/admin/providers")}
          >
            <Users size={20} className="mx-auto text-provider mb-1" />
            <p className="text-xs font-semibold">Providers</p>
          </Card>
          <Card
            className="p-4 cursor-pointer hover:shadow-md transition-all text-center relative"
            onClick={() => navigate("/admin/classes")}
          >
            <BookOpen size={20} className="mx-auto text-blue-600 mb-1" />
            <p className="text-xs font-semibold">Classes</p>
            {(pendingClasses?.length ?? 0) > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 text-[9px] h-5 min-w-5 px-1">
                {pendingClasses!.length}
              </Badge>
            )}
          </Card>
          <Card
            className="p-4 cursor-pointer hover:shadow-md transition-all text-center"
            onClick={() => navigate("/admin/residents")}
          >
            <HomeIcon size={20} className="mx-auto text-emerald-600 mb-1" />
            <p className="text-xs font-semibold">Residents</p>
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

      <BottomNav persona="admin" />
    </div>
  );
};

export default AdminDashboard;
