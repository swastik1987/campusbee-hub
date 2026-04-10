import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useProviderRegistrations } from "@/hooks/useProvider";
import { useProviderClasses, useUpdateClassStatus } from "@/hooks/useClasses";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Plus, Star, Users } from "lucide-react";

const STATUS_FILTERS = ["all", "draft", "pending_approval", "published", "paused", "archived"];
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending_approval: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  archived: "bg-gray-200 text-gray-500",
};
const STATUS_LABELS: Record<string, string> = {
  all: "All",
  draft: "Draft",
  pending_approval: "In Review",
  published: "Published",
  paused: "Paused",
  archived: "Archived",
};

const ProviderClasses = () => {
  const navigate = useNavigate();
  const { providerProfile } = useUser();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: registrations } = useProviderRegistrations(providerProfile?.id);
  const allRegIds = registrations?.map((r) => r.id) ?? [];

  const { data: classes, isLoading } = useProviderClasses(allRegIds, statusFilter);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <h2 className="text-lg font-bold">My Classes</h2>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f
                  ? "bg-provider text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {STATUS_LABELS[f] ?? f}
            </button>
          ))}
        </div>

        {/* Class list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : classes && classes.length > 0 ? (
          <div className="space-y-3">
            {classes.map((cls) => (
              <Card
                key={cls.id}
                className="flex gap-3 p-3 cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
                onClick={() => navigate(`/provider/classes/${cls.id}`)}
              >
                {cls.cover_image_url ? (
                  <img
                    src={cls.cover_image_url}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                    <BookOpen size={24} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold truncate">{cls.title}</h3>
                    <Badge className={`text-[10px] ${STATUS_COLORS[cls.status ?? "draft"]} border-0 shrink-0`}>
                      {STATUS_LABELS[cls.status ?? "draft"] ?? cls.status}
                    </Badge>
                  </div>
                  {(cls as any).common_area_approval_status === "rejected" && (
                    <p className="text-[10px] text-red-600 mt-0.5">
                      Rejected{(cls as any).common_area_rejection_reason ? `: ${(cls as any).common_area_rejection_reason}` : ""}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(cls.class_categories as any)?.name} · {(cls.provider_apartment_registrations as any)?.apartment_complexes?.name}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    {(cls.rating_count ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Star size={12} className="text-amber-500 fill-amber-500" />
                        {cls.total_rating}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <BookOpen size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No classes yet</p>
            <Button
              onClick={() => navigate("/provider/classes/new")}
              className="bg-provider hover:bg-provider/90 text-white rounded-xl"
            >
              <Plus size={16} className="mr-1" />
              Add Your First Class
            </Button>
          </div>
        )}
      </div>

      {/* FAB */}
      {classes && classes.length > 0 && (
        <div className="fixed bottom-20 right-4 z-30">
          <Button
            onClick={() => navigate("/provider/classes/new")}
            className="h-12 w-12 rounded-full bg-provider hover:bg-provider/90 text-white shadow-lg"
          >
            <Plus size={24} />
          </Button>
        </div>
      )}

      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderClasses;
