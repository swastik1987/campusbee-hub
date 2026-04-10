import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useAdminProviderRegistrations,
  useSuspendProvider,
  useReinstateProvider,
} from "@/hooks/useAdmin";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Users,
} from "lucide-react";
import { useCategories } from "@/hooks/useClasses";
import { toast } from "sonner";

const AdminProviders = () => {
  const navigate = useNavigate();
  const { currentApartment } = useUser();
  const aptId = currentApartment?.id;

  const [tab, setTab] = useState("active");
  const { data: registrations, isLoading } = useAdminProviderRegistrations(aptId, tab === "active" ? "approved" : "suspended");
  const { data: allCategories } = useCategories();

  const getCategoryNames = (ids: string[] | null): string[] => {
    if (!ids || !allCategories) return [];
    return ids
      .map((id) => {
        const cat = allCategories.find((c) => c.id === id);
        if (!cat) return null;
        const parent = cat.parent_category_id
          ? allCategories.find((p) => p.id === cat.parent_category_id)
          : null;
        return parent ? `${parent.name} › ${cat.name}` : cat.name;
      })
      .filter(Boolean) as string[];
  };

  const suspendProvider = useSuspendProvider();
  const reinstateProvider = useReinstateProvider();

  // Sheet states
  const [suspendSheet, setSuspendSheet] = useState<any>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const handleSuspend = async () => {
    if (!suspendSheet || !suspendReason.trim()) return;
    try {
      await suspendProvider.mutateAsync({
        registrationId: suspendSheet.id,
        reason: suspendReason.trim(),
      });
      toast.success("Provider suspended");
      setSuspendSheet(null);
      setSuspendReason("");
    } catch {
      toast.error("Failed to suspend");
    }
  };

  const handleReinstate = async (regId: string) => {
    try {
      await reinstateProvider.mutateAsync(regId);
      toast.success("Provider reinstated");
    } catch {
      toast.error("Failed to reinstate");
    }
  };

  const renderProviderCard = (reg: any) => {
    const prov = reg.service_providers as any;
    const user = prov?.users;
    return (
      <Card
        key={reg.id}
        className="p-4 space-y-3 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(`/admin/providers/${reg.id}`)}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-provider/10 text-provider text-xs">
              {user?.full_name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold truncate">
                {prov?.business_name || user?.full_name}
              </p>
              {prov?.is_verified && <CheckCircle2 size={12} className="text-blue-500 flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[9px] capitalize">{prov?.provider_type}</Badge>
              {prov?.experience_years && <span>{prov.experience_years} yrs</span>}
              {user?.email && <span className="truncate">· {user.email}</span>}
            </div>
          </div>
        </div>

        {(() => {
          const catNames = getCategoryNames(prov?.specialization_category_ids);
          const display = catNames.length > 0 ? catNames : (prov?.specializations ?? []);
          return display.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {display.slice(0, 6).map((s: string) => (
                <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
              ))}
              {display.length > 6 && (
                <Badge variant="outline" className="text-[10px]">+{display.length - 6} more</Badge>
              )}
            </div>
          ) : null;
        })()}

        {/* Suspension reason */}
        {reg.status === "suspended" && reg.suspension_reason && (
          <p className="text-xs text-red-600">
            Suspended: {reg.suspension_reason}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {reg.status === "approved" && (
            <Button
              size="sm" variant="outline"
              className="text-xs text-destructive border-destructive"
              onClick={() => { setSuspendSheet(reg); setSuspendReason(""); }}
            >
              <Ban size={14} className="mr-1" /> Suspend
            </Button>
          )}
          {reg.status === "suspended" && (
            <Button
              size="sm"
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleReinstate(reg.id)}
            >
              <RotateCcw size={14} className="mr-1" /> Reinstate
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/dashboard")} className="p-1">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">Provider Management</h2>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
            <TabsTrigger value="suspended" className="flex-1">Suspended</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : registrations && registrations.length > 0 ? (
              <div className="space-y-3">
                {registrations.map(renderProviderCard)}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Users size={28} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {tab === "suspended" ? "No suspended providers" : "No active providers"}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Suspend Sheet */}
      <Sheet open={!!suspendSheet} onOpenChange={() => setSuspendSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Suspend Provider</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Suspend{" "}
              <span className="font-semibold text-foreground">
                {(suspendSheet?.service_providers as any)?.business_name ||
                  (suspendSheet?.service_providers as any)?.users?.full_name}
              </span>
              ? This will hide their classes.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason for suspension..."
                rows={2}
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || suspendProvider.isPending}
              className="w-full bg-destructive hover:bg-destructive/90 text-white rounded-lg"
            >
              {suspendProvider.isPending ? <Loader2 size={16} className="animate-spin" /> : "Suspend Provider"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav persona="admin" />
    </div>
  );
};

export default AdminProviders;
