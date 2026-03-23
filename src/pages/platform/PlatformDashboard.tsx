import { useNavigate } from "react-router-dom";
import { usePlatformStats } from "@/hooks/usePlatformAdmin";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  GraduationCap,
  Users,
  UserCheck,
  ArrowRight,
} from "lucide-react";

const PlatformDashboard = () => {
  const { data: stats, isLoading } = usePlatformStats();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Platform Overview</h2>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Apartments"
            value={stats.totalApartments}
            icon={<Building2 size={20} className="text-blue-600" />}
            color="bg-blue-50"
          />
          <StatCard
            label="Providers"
            value={stats.totalProviders}
            icon={<UserCheck size={20} className="text-indigo-600" />}
            color="bg-indigo-50"
          />
          <StatCard
            label="Users"
            value={stats.totalSeekers}
            icon={<Users size={20} className="text-green-600" />}
            color="bg-green-50"
          />
          <StatCard
            label="Enrollments"
            value={stats.totalEnrollments}
            icon={<GraduationCap size={20} className="text-amber-600" />}
            color="bg-amber-50"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickLinkCard
          title="Manage Apartments"
          description="Approve pending apartments, assign admins"
          icon={<Building2 size={20} className="text-blue-600" />}
          onClick={() => navigate("/platform/apartments")}
        />
        <QuickLinkCard
          title="Manage Categories"
          description="Add, edit, or reorder class categories"
          icon={<GraduationCap size={20} className="text-indigo-600" />}
          onClick={() => navigate("/platform/categories")}
        />
      </div>
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
  value: number;
  icon: React.ReactNode;
  color: string;
}) => (
  <Card className="p-4">
    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color} mb-2`}>
      {icon}
    </div>
    <p className="text-2xl font-bold">{value.toLocaleString("en-IN")}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </Card>
);

const QuickLinkCard = ({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) => (
  <Card
    className="p-4 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4"
    onClick={onClick}
  >
    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <ArrowRight size={16} className="text-muted-foreground" />
  </Card>
);

export default PlatformDashboard;
