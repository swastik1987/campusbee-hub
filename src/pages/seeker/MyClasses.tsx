import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useMyEnrollments } from "@/hooks/useSeeker";
import BottomNav from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Calendar, ChevronRight, Clock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-100 text-green-700" },
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700" },
  completed: { label: "Done", color: "bg-gray-100 text-gray-500" },
  dropped: { label: "Dropped", color: "bg-red-100 text-red-600" },
  paused: { label: "Paused", color: "bg-gray-100 text-gray-500" },
};

type TabVal = "active" | "completed" | "all";

const MyClasses = () => {
  const navigate = useNavigate();
  const { profile, familyMembers } = useUser();
  const [tab, setTab] = useState<TabVal>("active");
  const [selectedChild, setSelectedChild] = useState<string>("all");

  const { data: enrollments, isLoading } = useMyEnrollments(
    profile?.id,
    tab === "active" ? "active" : tab === "completed" ? "completed" : undefined
  );

  const children = familyMembers.filter(
    (m) => m.relationship === "child" || m.relationship === "grandchild"
  );

  const filtered = (enrollments ?? []).filter((e) => {
    if (tab === "active") return e.status === "active" || e.status === "pending";
    if (tab === "completed") return e.status === "completed";
    return true;
  }).filter((e) => {
    if (selectedChild === "all") return true;
    return (e.family_members as any)?.id === selectedChild;
  });

  const tabs: { id: TabVal; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <h1 className="text-base font-bold">My Classes</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        {/* Child filter pills */}
        {children.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedChild("all")}
              className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                selectedChild === "all"
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              All
            </button>
            {children.map((child) => {
              const initials = child.full_name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) ?? "?";
              return (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedChild === child.id
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    selectedChild === child.id ? "bg-white/20" : "bg-primary/15 text-primary"
                  }`}>
                    {initials}
                  </span>
                  {child.full_name?.split(" ")[0]}
                </button>
              );
            })}
          </div>
        )}

        {/* Status tabs */}
        <div className="flex border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 pb-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((enrollment) => {
              const batch = enrollment.batches as any;
              const cls = batch?.classes;
              const schedules = batch?.batch_schedules ?? [];
              const member = enrollment.family_members as any;
              const providerName =
                cls?.provider_apartment_registrations?.service_providers?.business_name ||
                cls?.provider_apartment_registrations?.service_providers?.users?.full_name ||
                "";

              const scheduleSummary = schedules.length > 0
                ? schedules.map((s: any) => DAY_SHORT[s.day_of_week]).join("/") +
                  " · " + schedules[0]?.start_time?.slice(0, 5) + "–" + schedules[0]?.end_time?.slice(0, 5)
                : null;

              const statusCfg = STATUS_CONFIG[enrollment.status ?? ""] ?? { label: enrollment.status, color: "bg-gray-100 text-gray-500" };

              return (
                <button
                  key={enrollment.id}
                  onClick={() => navigate(`/enrollment/${enrollment.id}`)}
                  className="w-full flex gap-3 p-3.5 rounded-2xl border border-border bg-card text-left active:scale-[0.99] transition-transform"
                >
                  {cls?.cover_image_url ? (
                    <img
                      src={cls.cover_image_url}
                      alt=""
                      className="h-20 w-20 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                      <BookOpen size={22} className="text-primary/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-sm font-semibold truncate flex-1">{cls?.title}</h3>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    {providerName && (
                      <p className="text-xs text-muted-foreground mt-0.5">{providerName}</p>
                    )}
                    {member && (
                      <p className="text-[11px] font-medium text-primary mt-0.5">
                        {member.full_name ?? member.name}
                      </p>
                    )}
                    {scheduleSummary && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                        <Clock size={10} />
                        {scheduleSummary}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground flex-shrink-0 self-center" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              {tab === "active" ? (
                <BookOpen size={28} className="text-primary/50" />
              ) : (
                <Calendar size={28} className="text-primary/50" />
              )}
            </div>
            <p className="text-sm font-medium">
              {tab === "active" ? "No active classes" : "No completed classes yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {tab === "active" ? "Explore and enroll in a class near you." : "Classes you finish will appear here."}
            </p>
            {tab === "active" && (
              <Button
                onClick={() => navigate("/explore")}
                className="gradient-primary text-white rounded-xl mt-1 gap-2"
              >
                <Search size={15} /> Explore Classes
              </Button>
            )}
          </div>
        )}
      </div>

      <BottomNav persona="seeker" />
    </div>
  );
};

export default MyClasses;
