import { usePlatformStats, usePlatformGrowth } from "@/hooks/usePlatformAdmin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Building2, MapPin } from "lucide-react";
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
  Legend,
} from "recharts";
import ErrorState from "@/components/shared/ErrorState";

const PlatformAnalytics = () => {
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const { data: growth, isLoading: growthLoading, isError, refetch } = usePlatformGrowth();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <BarChart3 size={22} /> Platform Analytics
      </h2>

      {/* Summary */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStat label="Apartments" value={stats.totalApartments} />
          <MiniStat label="Providers" value={stats.totalProviders} />
          <MiniStat label="Users" value={stats.totalSeekers} />
          <MiniStat label="Enrollments" value={stats.totalEnrollments} />
        </div>
      ) : null}

      {growthLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : growth ? (
        <>
          {/* Growth Chart */}
          <Card className="p-4 md:p-6">
            <p className="text-sm font-semibold mb-4">Monthly Growth</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={growth.growth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={35} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#6366F1"
                  strokeWidth={2}
                  name="New Users"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="enrollments"
                  stroke="#22C55E"
                  strokeWidth={2}
                  name="Enrollments"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* City Breakdown */}
          <Card className="p-4 md:p-6">
            <p className="text-sm font-semibold mb-4 flex items-center gap-2">
              <MapPin size={16} /> Apartments by City
            </p>
            {growth.cityBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(120, growth.cityBreakdown.length * 40)}>
                  <BarChart data={growth.cityBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="city" type="category" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]} name="Apartments" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-4 flex flex-wrap gap-2">
                  {growth.cityBreakdown.map((c) => (
                    <Badge key={c.city} variant="secondary" className="text-xs">
                      {c.city}: {c.count}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
};

const MiniStat = ({ label, value }: { label: string; value: number }) => (
  <Card className="p-3">
    <p className="text-xl font-bold">{value.toLocaleString("en-IN")}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </Card>
);

export default PlatformAnalytics;
