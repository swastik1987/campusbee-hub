import { useState } from "react";
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
import { Calendar, Check, Clock, CreditCard, Home, Loader2, Users, X } from "lucide-react";
import { toast } from "sonner";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEE_LABELS: Record<string, string> = {
  per_session: "/session",
  monthly: "/month",
  quarterly: "/quarter",
  for_duration: " total",
  one_time: "",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-gray-100 text-gray-600",
  dropped: "bg-red-100 text-red-600",
  rejected: "bg-red-100 text-red-600",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  recorded: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  pending: "bg-gray-100 text-gray-600",
  disputed: "bg-red-100 text-red-600",
};

function getAge(dob: string | null): string | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return `${age}y`;
}

const ProviderStudents = () => {
  const { providerProfile } = useUser();
  const [tab, setTab] = useState("active");

  const { data: registrations } = useProviderRegistrations(providerProfile?.id);
  const approvedRegIds = registrations?.filter((r) => r.status === "approved").map((r) => r.id) ?? [];

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
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : enrollments && enrollments.length > 0 ? (
              <div className="space-y-3">
                {enrollments.map((enrollment) => {
                  const member = enrollment.family_members as any;
                  const batch = enrollment.batches as any;
                  const cls = batch?.classes;
                  const schedules = batch?.batch_schedules ?? [];
                  const family = member?.families;
                  const payments = (enrollment as any).payments as any[] ?? [];
                  const latestPayment = payments.length > 0
                    ? payments.sort((a: any, b: any) => new Date(b.paid_at ?? b.created_at ?? 0).getTime() - new Date(a.paid_at ?? a.created_at ?? 0).getTime())[0]
                    : null;
                  const age = getAge(member?.date_of_birth);
                  const scheduleSummary = schedules.map((s: any) => DAY_NAMES[s.day_of_week]).join(", ");
                  const timeSummary = schedules[0]
                    ? `${schedules[0].start_time?.slice(0, 5)}–${schedules[0].end_time?.slice(0, 5)}`
                    : "";

                  return (
                    <Card key={enrollment.id} className="p-4 space-y-3">
                      {/* Student info row */}
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 mt-0.5">
                          <AvatarImage src={member?.avatar_url} />
                          <AvatarFallback className="bg-provider/10 text-provider text-xs">
                            {member?.name?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">{member?.name}</p>
                            <Badge className={`text-[9px] border-0 shrink-0 ${STATUS_COLORS[enrollment.status ?? ""] ?? "bg-gray-100"}`}>
                              {enrollment.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground mt-0.5">
                            {member?.relationship && <span>{member.relationship}</span>}
                            {age && <span>· {age}</span>}
                            {member?.age_group && !age && <span>· {member.age_group}</span>}
                          </div>
                          {(family?.flat_number || family?.block_tower) && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                              <Home size={10} />
                              {family.flat_number && <span>Flat {family.flat_number}</span>}
                              {family.block_tower && <span>· {family.block_tower}</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Batch details */}
                      <div className="rounded-lg bg-muted/50 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold">{cls?.title}</p>
                          <p className="text-[10px] font-medium text-provider">
                            ₹{batch?.fee_amount}{FEE_LABELS[batch?.fee_frequency] ?? ""}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{batch?.batch_name}</p>
                        {scheduleSummary && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Calendar size={10} />
                            <span>{scheduleSummary}</span>
                            {timeSummary && (
                              <>
                                <span>·</span>
                                <Clock size={10} />
                                <span>{timeSummary}</span>
                              </>
                            )}
                          </div>
                        )}
                        {(batch?.start_date || batch?.end_date) && (
                          <p className="text-[10px] text-muted-foreground">
                            {batch.start_date && `From ${new Date(batch.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                            {batch.end_date && ` — To ${new Date(batch.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                          </p>
                        )}
                      </div>

                      {/* Payment info for pending enrollments */}
                      {enrollment.status === "pending" && (
                        <>
                          {latestPayment ? (
                            <div className="rounded-lg border p-2.5 space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <CreditCard size={12} className="text-muted-foreground" />
                                  <span className="text-xs font-medium">Payment</span>
                                </div>
                                <Badge className={`text-[9px] border-0 ${PAYMENT_STATUS_COLORS[latestPayment.status] ?? "bg-gray-100"}`}>
                                  {latestPayment.status}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>₹{latestPayment.amount}</span>
                                {latestPayment.paid_at && (
                                  <span>{new Date(latestPayment.paid_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                                )}
                              </div>
                              {latestPayment.upi_transaction_id && (
                                <p className="text-[10px] font-mono text-muted-foreground">
                                  Ref: {latestPayment.upi_transaction_id}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed p-2.5">
                              <div className="flex items-center gap-1.5">
                                <CreditCard size={12} className="text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">No payment recorded yet</span>
                              </div>
                            </div>
                          )}

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
                        </>
                      )}

                      {/* Enrolled date for active students */}
                      {enrollment.status === "active" && enrollment.enrolled_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Enrolled {new Date(enrollment.enrolled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
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
