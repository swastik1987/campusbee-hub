import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useProviderRegistrations } from "@/hooks/useProvider";
import { useProviderEnrollments, useUpdateEnrollmentStatus } from "@/hooks/useEngagement";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Loader2, Users, X } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-gray-100 text-gray-600",
  dropped: "bg-red-100 text-red-600",
};

const ProviderStudents = () => {
  const navigate = useNavigate();
  const { providerProfile } = useUser();
  const [tab, setTab] = useState("active");

  const { data: registrations } = useProviderRegistrations(providerProfile?.id);
  const approvedRegIds = registrations?.filter((r) => r.status === "approved").map((r) => r.id) ?? [];

  // Get all batch IDs for the provider
  const { data: batchIds } = useQuery({
    queryKey: ["provider-batch-ids", approvedRegIds],
    enabled: approvedRegIds.length > 0,
    queryFn: async () => {
      const { data: classes } = await supabase
        .from("classes")
        .select("id")
        .in("provider_registration_id", approvedRegIds);
      if (!classes?.length) return [];
      const { data: batches } = await supabase
        .from("batches")
        .select("id")
        .in("class_id", classes.map((c) => c.id));
      return batches?.map((b) => b.id) ?? [];
    },
  });

  const statusFilter = tab === "pending" ? "pending" : tab === "active" ? "active" : "all";
  const { data: enrollments, isLoading } = useProviderEnrollments(batchIds ?? [], statusFilter);
  const updateStatus = useUpdateEnrollmentStatus();

  const handleApprove = async (enrollmentId: string) => {
    try {
      await updateStatus.mutateAsync({ enrollmentId, status: "active" });
      toast.success("Enrollment approved");
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (enrollmentId: string) => {
    try {
      await updateStatus.mutateAsync({ enrollmentId, status: "rejected" });
      toast.success("Enrollment rejected");
    } catch {
      toast.error("Failed to reject");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <h2 className="text-lg font-bold">Students</h2>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">Pending</TabsTrigger>
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : enrollments && enrollments.length > 0 ? (
              <div className="space-y-2">
                {enrollments.map((enrollment) => {
                  const member = enrollment.family_members as any;
                  const batch = enrollment.batches as any;
                  const cls = batch?.classes;
                  return (
                    <Card key={enrollment.id} className="p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={member?.avatar_url} />
                          <AvatarFallback className="bg-provider/10 text-provider text-xs">
                            {member?.name?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{member?.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {member?.relationship} · {cls?.title} · {batch?.batch_name}
                          </p>
                        </div>
                        <Badge className={`text-[10px] border-0 ${STATUS_COLORS[enrollment.status ?? ""] ?? "bg-gray-100"}`}>
                          {enrollment.status}
                        </Badge>
                      </div>

                      {enrollment.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs text-destructive border-destructive"
                            onClick={() => handleReject(enrollment.id)}
                            disabled={updateStatus.isPending}
                          >
                            <X size={14} className="mr-1" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApprove(enrollment.id)}
                            disabled={updateStatus.isPending}
                          >
                            <Check size={14} className="mr-1" /> Approve
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Users size={28} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {tab === "pending" ? "No pending enrollments" : "No students found"}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderStudents;
