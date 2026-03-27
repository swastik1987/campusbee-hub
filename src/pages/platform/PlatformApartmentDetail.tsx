import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  GraduationCap,
  MapPin,
  Phone,
  User,
  UserCog,
  Users,
} from "lucide-react";
import ErrorState from "@/components/shared/ErrorState";

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700",
};

function useApartmentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["platform-apartment-detail", id],
    enabled: !!id,
    queryFn: async () => {
      // Use SECURITY DEFINER RPC for admin/requester details (bypasses users RLS)
      const { data: rpcData, error: rpcError } = await supabase.rpc("platform_get_apartment_detail", { apt_id: id! });
      if (rpcError) throw rpcError;
      const apt = (rpcData as any)?.[0];
      if (!apt) throw new Error("Apartment not found");

      // Get counts
      const [famRes, provRes, classRes, enrollRes] = await Promise.all([
        supabase.from("families").select("id", { count: "exact", head: true }).eq("apartment_id", id!),
        supabase.from("provider_apartment_registrations").select("id", { count: "exact", head: true }).eq("apartment_id", id!),
        supabase.from("provider_apartment_registrations").select("id").eq("apartment_id", id!).then(async (regs) => {
          const regIds = (regs.data ?? []).map((r) => r.id);
          if (regIds.length === 0) return { count: 0 };
          return supabase.from("classes").select("id", { count: "exact", head: true }).in("provider_registration_id", regIds).eq("status", "published");
        }),
        supabase.from("provider_apartment_registrations").select("id").eq("apartment_id", id!).then(async (regs) => {
          const regIds = (regs.data ?? []).map((r) => r.id);
          if (regIds.length === 0) return { count: 0 };
          const { data: classIds } = await supabase.from("classes").select("id").in("provider_registration_id", regIds);
          if (!classIds || classIds.length === 0) return { count: 0 };
          const { data: batchIds } = await supabase.from("batches").select("id").in("class_id", classIds.map((c) => c.id));
          if (!batchIds || batchIds.length === 0) return { count: 0 };
          return supabase.from("enrollments").select("id", { count: "exact", head: true }).in("batch_id", batchIds.map((b) => b.id)).in("status", ["active", "pending"]);
        }),
      ]);

      // Get providers list
      const { data: providers } = await supabase
        .from("provider_apartment_registrations")
        .select(`
          id, status, created_at,
          service_providers(business_name, provider_type, users(full_name, email))
        `)
        .eq("apartment_id", id!)
        .order("created_at", { ascending: false });

      return {
        ...apt,
        familyCount: famRes.count ?? 0,
        providerCount: provRes.count ?? 0,
        classCount: classRes.count ?? 0,
        enrollmentCount: enrollRes.count ?? 0,
        adminName: apt.admin_name ?? null,
        adminEmail: apt.admin_email ?? null,
        adminPhone: apt.admin_phone ?? null,
        requesterName: apt.requester_name ?? null,
        requesterEmail: apt.requester_email ?? null,
        requesterPhone: apt.requester_phone ?? null,
        providers: providers ?? [],
      };
    },
  });
}

const PlatformApartmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: apt, isLoading, isError, refetch } = useApartmentDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (isError || !apt) return <ErrorState onRetry={() => refetch()} />;

  const stats = [
    { label: "Families", value: apt.familyCount, icon: Users, color: "text-blue-600 bg-blue-100" },
    { label: "Providers", value: apt.providerCount, icon: GraduationCap, color: "text-indigo-600 bg-indigo-100" },
    { label: "Classes", value: apt.classCount, icon: BookOpen, color: "text-green-600 bg-green-100" },
    { label: "Enrollments", value: apt.enrollmentCount, icon: Users, color: "text-amber-600 bg-amber-100" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/platform/apartments")} className="p-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{apt.name}</h2>
            <Badge className={`text-[10px] border-0 ${STATUS_COLORS[apt.status ?? "pending"]}`}>
              {apt.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin size={12} /> {apt.locality}, {apt.city}
            {apt.pin_code && ` — ${apt.pin_code}`}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon size={18} />
              </div>
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Admin Info */}
      <Card className="p-4 space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <UserCog size={14} /> Apartment Admin
        </h3>
        {apt.adminName ? (
          <div className="text-xs space-y-1">
            <p className="font-medium">{apt.adminName}</p>
            {apt.adminEmail && <p className="text-muted-foreground">{apt.adminEmail}</p>}
            {apt.adminPhone && <p className="text-muted-foreground flex items-center gap-1"><Phone size={10} /> {apt.adminPhone}</p>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No admin assigned</p>
        )}
      </Card>

      {/* Requester Info */}
      {apt.requesterName && (
        <Card className="p-4 space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <User size={14} /> Registered By
          </h3>
          <div className="text-xs space-y-1">
            <p className="font-medium">{apt.requesterName}</p>
            {apt.requesterEmail && <p className="text-muted-foreground">{apt.requesterEmail}</p>}
            {apt.requesterPhone && <p className="text-muted-foreground flex items-center gap-1"><Phone size={10} /> {apt.requesterPhone}</p>}
          </div>
        </Card>
      )}

      {/* Providers List */}
      <div>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <GraduationCap size={14} /> Registered Providers ({apt.providers.length})
        </h3>
        {apt.providers.length > 0 ? (
          <div className="space-y-2">
            {apt.providers.map((reg: any) => {
              const sp = reg.service_providers;
              const provName = sp?.business_name || sp?.users?.full_name || "Provider";
              return (
                <Card key={reg.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{provName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {sp?.provider_type} · {sp?.users?.email}
                    </p>
                  </div>
                  <Badge className={`text-[10px] border-0 ${STATUS_COLORS[reg.status ?? "pending"]}`}>
                    {reg.status}
                  </Badge>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No providers registered yet</p>
        )}
      </div>
    </div>
  );
};

export default PlatformApartmentDetail;
