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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Calendar, Clock, Search } from "lucide-react";

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
  const { profile } = useUser();
  const [tab, setTab] = useState("active");

  const { data: enrollments, isLoading } = useMyEnrollments(profile?.id, tab === "active" ? "active" : tab === "completed" ? "completed" : undefined);

  const activeEnrollments = enrollments?.filter((e) => e.status === "active" || e.status === "pending") ?? [];
  const completedEnrollments = enrollments?.filter((e) => e.status === "completed") ?? [];

  const displayList = tab === "active" ? activeEnrollments : tab === "completed" ? completedEnrollments : enrollments ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <h2 className="text-lg font-bold">My Classes</h2>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
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
                  const providerName = cls?.provider_apartment_registrations?.service_providers?.business_name
                    || cls?.provider_apartment_registrations?.service_providers?.users?.full_name
                    || "";

                  const scheduleSummary = schedules.length > 0
                    ? schedules.map((s: any) => DAY_SHORT[s.day_of_week]).join("/") +
                      " · " + schedules[0]?.start_time?.slice(0, 5) + "–" + schedules[0]?.end_time?.slice(0, 5)
                    : null;

                  return (
                    <Card
                      key={enrollment.id}
                      className="flex gap-3 p-3 cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
                      onClick={() => navigate(`/enrollment/${enrollment.id}`)}
                    >
                      {cls?.cover_image_url ? (
                        <img src={cls.cover_image_url} alt="" className="h-20 w-20 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                          <BookOpen size={24} className="text-muted-foreground" />
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
                            {member.name} · {member.relationship}
                          </p>
                        )}
                        {scheduleSummary && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                            <Clock size={10} />
                            {scheduleSummary}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  {tab === "active" ? (
                    <BookOpen size={28} className="text-muted-foreground" />
                  ) : (
                    <Calendar size={28} className="text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {tab === "active" ? "No active enrollments" : "No completed classes yet"}
                </p>
                {tab === "active" && (
                  <Button
                    onClick={() => navigate("/explore")}
                    className="bg-primary hover:bg-primary/90 text-white rounded-xl"
                  >
                    <Search size={16} className="mr-1" /> Explore Classes
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav persona="seeker" />
    </div>
  );
};

export default MyClasses;
