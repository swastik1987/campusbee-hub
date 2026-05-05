import { useNavigate } from "react-router-dom";
import { usePlatformStats } from "@/hooks/usePlatformAdmin";
import { usePendingCategoryRequestCount } from "@/hooks/useCategoryRequests";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderTree,
  GraduationCap,
  Users,
  UserCheck,
  ArrowRight,
} from "lucide-react";

const PlatformDashboard = () => {
  const { data: stats, isLoading } = usePlatformStats();
  const { data: pendingCatCount } = usePendingCategoryRequestCount();
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
            label="Providers"
            value={stats.totalProviders}
            icon={<UserCheck size={20} className="text-indigo-600" />}
            color="bg-indigo-50"
          />
          <StatCard
            label="Classes"
            value={stats.totalPublishedClasses}
            icon={<GraduationCap size={20} className="text-blue-600" />}
            color="bg-blue-50"
          />
          <StatCard
            label="Users"
            value={stats.totalSeekers}
            icon={<Users size={20} className="text-green-600" />}
            color="bg-green-50"
          />
          <StatCard
            label="Active Enrolments"
            value={stats.totalActiveEnrollments}
            icon={<GraduationCap size={20} className="text-amber-600" />}
            color="bg-amber-50"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickLinkCard
          title="Manage Providers"
          description="View providers, verify badges, manage subscriptions"
          icon={<UserCheck size={20} className="text-indigo-600" />}
          onClick={() => navigate("/platform/providers")}
        />
        <QuickLinkCard
          title="Manage Categories"
          description="Add, edit, or reorder class categories"
          icon={<GraduationCap size={20} className="text-indigo-600" />}
          onClick={() => navigate("/platform/categories")}
        />
        <QuickLinkCard
          title="Category Requests"
          description="Review provider requests for new categories"
          icon={<FolderTree size={20} className="text-amber-600" />}
          onClick={() => navigate("/platform/categories")}
          badge={pendingCatCount && pendingCatCount > 0 ? pendingCatCount : undefined}
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
  badge,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  badge?: number;
}) => (
  <Card
    className="p-4 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4"
    onClick={onClick}
  >
    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {badge !== undefined && (
          <Badge className="bg-amber-500 text-white text-[10px] h-4 px-1.5 min-w-4 flex items-center justify-center">
            {badge}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <ArrowRight size={16} className="text-muted-foreground" />
  </Card>
);

export default PlatformDashboard;
