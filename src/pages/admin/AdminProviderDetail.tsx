import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useAdminProviderDetail,
  useSuspendProvider,
  useReinstateProvider,
  useAdminClassesByRegistration,
  useAdminUpdateClassStatus,
} from "@/hooks/useAdmin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  Award,
  BookOpen,
  Users,
  DollarSign,
  Ban,
  RotateCcw,
  Clock,
  CheckCircle2,
  Home,
  Play,
} from "lucide-react";
import { useCategories } from "@/hooks/useClasses";
import { toast } from "sonner";

const AdminProviderDetail = () => {
  const { registrationId } = useParams<{ registrationId: string }>();
  const navigate = useNavigate();
  const { profile } = useUser();

  const { data: detail, isLoading } = useAdminProviderDetail(registrationId);
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
  const { data: providerClasses, isLoading: classesLoading } = useAdminClassesByRegistration(registrationId);
  const updateClassStatus = useAdminUpdateClassStatus();

  // Provider suspend sheet
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  // Class suspend sheet
  const [classSuspendOpen, setClassSuspendOpen] = useState(false);
  const [classSuspendId, setClassSuspendId] = useState("");
  const [classSuspendReason, setClassSuspendReason] = useState("");

  const prov = (detail as any)?.service_providers as any;
  const user = prov?.users;

  const handleSuspend = async () => {
    if (!registrationId || !suspendReason.trim()) return;
    try {
      await suspendProvider.mutateAsync({
        registrationId,
        reason: suspendReason.trim(),
      });
      toast.success("Provider suspended");
      setSuspendOpen(false);
      setSuspendReason("");
    } catch {
      toast.error("Failed to suspend provider");
    }
  };

  const handleReinstate = async () => {
    if (!registrationId) return;
    try {
      await reinstateProvider.mutateAsync(registrationId);
      toast.success("Provider reinstated");
    } catch {
      toast.error("Failed to reinstate provider");
    }
  };

  const handleSuspendClass = async () => {
    if (!classSuspendId || !classSuspendReason.trim()) return;
    const providerUserId = user?.id;
    if (!providerUserId) return;
    try {
      await updateClassStatus.mutateAsync({
        classId: classSuspendId,
        status: "paused",
        providerUserId,
        reason: classSuspendReason.trim(),
      });
      toast.success("Class suspended");
      setClassSuspendOpen(false);
      setClassSuspendReason("");
      setClassSuspendId("");
    } catch {
      toast.error("Failed to suspend class");
    }
  };

  const handleReactivateClass = async (classId: string) => {
    const providerUserId = user?.id;
    if (!providerUserId) return;
    try {
      await updateClassStatus.mutateAsync({
        classId,
        status: "published",
        providerUserId,
      });
      toast.success("Class reactivated");
    } catch {
      toast.error("Failed to reactivate class");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Approved</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
      case "suspended":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Suspended</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status ?? "Unknown"}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="mx-auto w-full max-w-2xl px-4 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="mx-auto w-full max-w-2xl px-4 py-4">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => navigate(-1)} className="p-1">
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-lg font-bold">Provider Details</h2>
          </div>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Users size={32} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Provider not found</p>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-8">
      <div className="mx-auto w-full max-w-2xl px-4 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">Provider Details</h2>
          <div className="ml-auto">{getStatusBadge(detail.status)}</div>
        </div>

        {/* Provider Profile */}
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-lg font-semibold">
              {user?.full_name
                ? user.full_name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold truncate">{user?.full_name ?? "Unknown"}</h3>
              {prov?.is_verified && (
                <CheckCircle2 size={16} className="text-blue-500 flex-shrink-0" />
              )}
            </div>
            {prov?.business_name && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 size={14} />
                <span className="truncate">{prov.business_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="capitalize text-xs">
                {prov?.provider_type ?? "individual"}
              </Badge>
              {prov?.is_verified && (
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
                  Verified
                </Badge>
              )}
            </div>
            {prov?.bio && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{prov.bio}</p>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center space-y-1">
            <BookOpen size={18} className="mx-auto text-emerald-600" />
            <p className="text-lg font-bold">{detail.classCount ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Classes</p>
          </Card>
          <Card className="p-3 text-center space-y-1">
            <Users size={18} className="mx-auto text-emerald-600" />
            <p className="text-lg font-bold">{detail.activeStudents ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Active Students</p>
          </Card>
          <Card className="p-3 text-center space-y-1">
            <DollarSign size={18} className="mx-auto text-emerald-600" />
            <p className="text-lg font-bold">{formatCurrency(detail.totalRevenue ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground">Revenue</p>
          </Card>
        </div>

        {/* Contact Section */}
        <Card className="p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Phone size={16} className="text-emerald-600" />
            Contact Information
          </h4>
          <div className="space-y-2.5">
            {user?.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail size={14} className="text-muted-foreground flex-shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
            )}
            {user?.mobile_number && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone size={14} className="text-muted-foreground flex-shrink-0" />
                <span>{user.mobile_number}</span>
              </div>
            )}
            {prov?.whatsapp_number && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone size={14} className="text-emerald-600 flex-shrink-0" />
                <span>{prov.whatsapp_number}</span>
                <Badge variant="outline" className="text-[10px] ml-1">WhatsApp</Badge>
              </div>
            )}
          </div>
        </Card>

        {/* Experience & Qualifications */}
        <Card className="p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Award size={16} className="text-emerald-600" />
            Experience & Qualifications
          </h4>
          <div className="space-y-3">
            {prov?.experience_years != null && (
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} className="text-muted-foreground flex-shrink-0" />
                <span>{prov.experience_years} years of experience</span>
              </div>
            )}
            {prov?.qualifications && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Qualifications</p>
                <p className="text-sm">{prov.qualifications}</p>
              </div>
            )}
            {(() => {
              const catNames = getCategoryNames(prov?.specialization_category_ids);
              const display = catNames.length > 0 ? catNames : (prov?.specializations ?? []);
              return display.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Categories & Specializations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {display.map((s: string) => (
                      <Badge key={s} variant="outline" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </Card>

        {/* Registration Timeline */}
        <Card className="p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Clock size={16} className="text-emerald-600" />
            Registration Timeline
          </h4>
          <div className="relative pl-6 space-y-4">
            {/* Timeline line */}
            <div className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />

            {/* Applied */}
            <div className="relative">
              <div className="absolute -left-6 top-0.5 h-[18px] w-[18px] rounded-full bg-emerald-100 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Applied</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(detail.created_at) ?? "Unknown"}
                </p>
              </div>
            </div>

            {/* Approved */}
            <div className="relative">
              <div
                className={`absolute -left-6 top-0.5 h-[18px] w-[18px] rounded-full flex items-center justify-center ${
                  detail.approved_at ? "bg-emerald-100" : "bg-muted"
                }`}
              >
                <div
                  className={`h-2 w-2 rounded-full ${
                    detail.approved_at ? "bg-emerald-600" : "bg-muted-foreground/30"
                  }`}
                />
              </div>
              <div>
                <p className={`text-sm font-medium ${!detail.approved_at ? "text-muted-foreground" : ""}`}>
                  Approved
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(detail.approved_at) ?? "Pending"}
                </p>
              </div>
            </div>

            {/* Suspended (only show if ever suspended) */}
            {detail.suspended_at && (
              <div className="relative">
                <div className="absolute -left-6 top-0.5 h-[18px] w-[18px] rounded-full bg-red-100 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-700">Suspended</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(detail.suspended_at)}
                  </p>
                  {detail.suspension_reason && (
                    <p className="text-xs text-red-600 mt-0.5">
                      Reason: {detail.suspension_reason}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Classes */}
        <Card className="p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen size={16} className="text-emerald-600" />
            Classes
          </h4>
          {classesLoading ? (
            <div className="space-y-2">
              <div className="h-10 rounded-lg bg-muted animate-pulse" />
              <div className="h-10 rounded-lg bg-muted animate-pulse" />
            </div>
          ) : !providerClasses || providerClasses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classes yet.</p>
          ) : (
            <div className="space-y-2">
              {providerClasses.map((cls: any) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{cls.title}</p>
                      {cls.requires_common_area === false && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                          <Home size={10} />
                          Home-based
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {cls.class_categories?.name && (
                        <span className="text-[10px] text-muted-foreground">{cls.class_categories.name}</span>
                      )}
                      <span
                        className={`text-[10px] font-medium capitalize ${
                          cls.status === "published"
                            ? "text-emerald-600"
                            : cls.status === "paused"
                            ? "text-red-600"
                            : "text-amber-600"
                        }`}
                      >
                        {cls.status}
                      </span>
                    </div>
                  </div>
                  {cls.status === "published" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs shrink-0"
                      onClick={() => {
                        setClassSuspendId(cls.id);
                        setClassSuspendReason("");
                        setClassSuspendOpen(true);
                      }}
                    >
                      <Ban size={12} className="mr-1" />
                      Suspend
                    </Button>
                  )}
                  {cls.status === "paused" && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs shrink-0"
                      onClick={() => handleReactivateClass(cls.id)}
                      disabled={updateClassStatus.isPending}
                    >
                      <Play size={12} className="mr-1" />
                      Reactivate
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-1">
          {detail.status === "approved" && (
            <Button
              variant="outline"
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => {
                setSuspendReason("");
                setSuspendOpen(true);
              }}
            >
              <Ban size={16} className="mr-1.5" />
              Suspend Provider
            </Button>
          )}
          {detail.status === "suspended" && (
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleReinstate}
              disabled={reinstateProvider.isPending}
            >
              <RotateCcw size={16} className="mr-1.5" />
              {reinstateProvider.isPending ? "Reinstating..." : "Reinstate Provider"}
            </Button>
          )}
        </div>
      </div>

      {/* Suspend Provider Sheet */}
      <Sheet open={suspendOpen} onOpenChange={setSuspendOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Suspend Provider</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Suspend{" "}
              <span className="font-semibold text-foreground">
                {prov?.business_name || user?.full_name}
              </span>
              ? This will hide their classes from seekers.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for Suspension</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Enter the reason for suspension..."
                rows={3}
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || suspendProvider.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              {suspendProvider.isPending ? "Suspending..." : "Suspend Provider"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Suspend Class Sheet */}
      <Sheet open={classSuspendOpen} onOpenChange={setClassSuspendOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Suspend Class</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This class will be hidden from residents. The provider will be notified.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for Suspension</Label>
              <Textarea
                value={classSuspendReason}
                onChange={(e) => setClassSuspendReason(e.target.value)}
                placeholder="e.g. Safety concern, complaint received..."
                rows={3}
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleSuspendClass}
              disabled={!classSuspendReason.trim() || updateClassStatus.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              {updateClassStatus.isPending ? "Suspending..." : "Suspend Class"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminProviderDetail;
