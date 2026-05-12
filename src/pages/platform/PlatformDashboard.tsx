import { useNavigate } from "react-router-dom";
import {
  usePlatformStats,
  useModerationQueue,
  usePlatformSubscriptionRequests,
  usePlatformSponsoredRequests,
} from "@/hooks/usePlatformAdmin";
import { usePendingCategoryRequestCount } from "@/hooks/useCategoryRequests";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Crown,
  FolderTree,
  GraduationCap,
  Megaphone,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";

const PlatformDashboard = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = usePlatformStats();
  const { data: pendingCatCount } = usePendingCategoryRequestCount();

  // Pending counts for badge indicators
  const { data: moderationQueue } = useModerationQueue();            // defaults to in_review
  const { data: subRequests }     = usePlatformSubscriptionRequests("pending");
  const { data: sponsoredReqs }   = usePlatformSponsoredRequests("pending");

  const moderationCount  = (moderationQueue  as any[])?.length ?? 0;
  const subscriptionCount = (subRequests     as any[])?.length ?? 0;
  const sponsoredCount   = (sponsoredReqs    as any[])?.length ?? 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Platform Overview</h2>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Instructors"
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

      {/* Quick links */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <QuickLinkCard
            title="Moderation Queue"
            description="Review AI-flagged images and text before they go public"
            icon={<ShieldAlert size={20} className="text-red-500" />}
            iconBg="bg-red-50"
            onClick={() => navigate("/platform/moderation")}
            badge={moderationCount > 0 ? moderationCount : undefined}
            badgeColor="bg-red-500"
          />
          <QuickLinkCard
            title="Subscription Requests"
            description="Approve or reject Premium upgrade requests from instructors"
            icon={<Crown size={20} className="text-amber-600" />}
            iconBg="bg-amber-50"
            onClick={() => navigate("/platform/subscriptions")}
            badge={subscriptionCount > 0 ? subscriptionCount : undefined}
            badgeColor="bg-amber-500"
          />
          <QuickLinkCard
            title="Sponsored Listings"
            description="Manage featured slot requests for the Explore top-3"
            icon={<Megaphone size={20} className="text-indigo-600" />}
            iconBg="bg-indigo-50"
            onClick={() => navigate("/platform/sponsored")}
            badge={sponsoredCount > 0 ? sponsoredCount : undefined}
            badgeColor="bg-indigo-500"
          />
          <QuickLinkCard
            title="Instructors Directory"
            description="Verify badges, suspend / reinstate, manage tiers"
            icon={<UserCheck size={20} className="text-blue-600" />}
            iconBg="bg-blue-50"
            onClick={() => navigate("/platform/providers")}
          />
          <QuickLinkCard
            title="Category Requests"
            description="Review provider requests for new class categories"
            icon={<FolderTree size={20} className="text-amber-600" />}
            iconBg="bg-amber-50"
            onClick={() => navigate("/platform/categories")}
            badge={
              pendingCatCount && pendingCatCount > 0 ? pendingCatCount : undefined
            }
            badgeColor="bg-amber-500"
          />
          <QuickLinkCard
            title="Manage Categories"
            description="Add, edit, or reorder class categories"
            icon={<FolderTree size={20} className="text-slate-600" />}
            iconBg="bg-slate-50"
            onClick={() => navigate("/platform/categories")}
          />
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────

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
  iconBg = "bg-muted",
  onClick,
  badge,
  badgeColor = "bg-primary",
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg?: string;
  onClick: () => void;
  badge?: number;
  badgeColor?: string;
}) => (
  <Card
    className="p-4 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4"
    onClick={onClick}
  >
    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {badge !== undefined && (
          <Badge
            className={`${badgeColor} text-white text-[10px] h-4 px-1.5 min-w-4 flex items-center justify-center border-0`}
          >
            {badge}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <ArrowRight size={16} className="text-muted-foreground shrink-0" />
  </Card>
);

export default PlatformDashboard;
