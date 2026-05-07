import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useMyEnrollments } from "@/hooks/useSeeker";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Calendar, Clock, Search, Users } from "lucide-react";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-gray-100 text-gray-600",
  dropped: "bg-red-100 text-red-600",
  paused: "bg-gray-100 text-gray-600",
};

const MyClasses = () => {
  const navigate = useNavigate();
  const { profile, familyMembers } = useUser();
  const [tab, setTab] = useState("active");
  const [memberFilter, setMemberFilter] = useState<string>("all");

  const { data: enrollments, isLoading } = useMyEnrollments(profile?.id, tab === "active" ? "active" : tab === "completed" ? "completed" : undefined);

  const activeEnrollments = enrollments?.filter((e) => e.status === "active" || e.status === "pending") ?? [];
  const completedEnrollments = enrollments?.filter((e) => e.status === "completed") ?? [];

  const rawList = tab === "active" ? activeEnrollments : tab === "completed" ? completedEnrollments : enrollments ?? [];
  const displayList = memberFilter === "all"
    ? rawList
    : rawList.filter((e) => (e.family_members as any)?.id === memberFilter);

  return (
    <div className="seeker-theme flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <h2 className="text-lg font-bold">My Classes</h2>

        {/* Tab strip */}
        <div className="flex gap-1 rounded-2xl p-1" style={{ backgroundColor: "oklch(0.94 0.04 250)" }}>
          {["active", "completed"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded-xl py-2 text-sm font-semibold transition-all"
              style={tab === t ? {
                background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))",
                color: "white",
              } : {
                color: "oklch(0.55 0.16 250)",
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Child filter chips */}
        {familyMembers.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setMemberFilter("all")}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all"
              style={memberFilter === "all" ? {
                background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))",
                color: "white",
              } : {
                backgroundColor: "oklch(0.94 0.04 250)",
                color: "oklch(0.50 0.16 250)",
              }}
            >
              <Users size={11} />
              All
            </button>
            {familyMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => setMemberFilter(memberFilter === member.id ? "all" : member.id)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all"
                style={memberFilter === member.id ? {
                  background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))",
                  color: "white",
                } : {
                  backgroundColor: "oklch(0.94 0.04 250)",
                  color: "oklch(0.50 0.16 250)",
                }}
              >
                {member.full_name?.split(" ")[0]}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : displayList.length > 0 ? (
          <div className="space-y-3">
            {displayList.map((enrollment) => {
              const batch = enrollment.batches as any;
              const cls = batch?.classes;
              const schedules = batch?.batch_schedules ?? [];
              const member = enrollment.family_members as any;

              const scheduleSummary = schedules.length > 0
                ? schedules.map((s: any) => DAY_SHORT[s.day_of_week]).join("/") +
                  " · " + schedules[0]?.start_time?.slice(0, 5) + "–" + schedules[0]?.end_time?.slice(0, 5)
                : null;

              const isActive = enrollment.status === "active";

              return (
                <Card
                  key={enrollment.id}
                  className="overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
                  style={isActive ? { borderColor: "oklch(0.62 0.20 250 / 0.3)" } : undefined}
                  onClick={() => navigate(`/enrollment/${enrollment.id}`)}
                >
                  {/* Gradient accent bar on active */}
                  {isActive && (
                    <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))" }} />
                  )}
                  <div className="flex gap-3 p-3">
                    {cls?.cover_image_url ? (
                      <img src={cls.cover_image_url} alt="" className="h-20 w-20 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: "oklch(0.94 0.04 250)" }}>
                        <BookOpen size={24} style={{ color: "oklch(0.62 0.20 250)" }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="text-sm font-semibold truncate">{cls?.title}</h3>
                        <Badge className={`text-[10px] border-0 shrink-0 ${STATUS_COLORS[enrollment.status ?? ""] ?? "bg-gray-100"}`}>
                          {enrollment.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{batch?.batch_name}</p>
                      {member && (
                        <p className="text-[10px] text-muted-foreground">
                          {member.full_name ?? member.name} · {member.relationship}
                        </p>
                      )}
                      {scheduleSummary && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                          <Clock size={10} />
                          {scheduleSummary}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: "oklch(0.94 0.04 250)" }}>
              {tab === "active" ? (
                <BookOpen size={28} style={{ color: "oklch(0.62 0.20 250)" }} />
              ) : (
                <Calendar size={28} style={{ color: "oklch(0.62 0.20 250)" }} />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {tab === "active" ? "No active enrollments" : "No completed classes yet"}
            </p>
            {tab === "active" && (
              <button
                onClick={() => navigate("/explore")}
                className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))" }}
              >
                <Search size={15} /> Explore Classes
              </button>
            )}
          </div>
        )}
      </div>

      <BottomNav persona="seeker" />
    </div>
  );
};

export default MyClasses;
