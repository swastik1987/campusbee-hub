import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  usePlatformApartments,
  useApproveApartment,
  useRejectApartment,
  useCreateApartment,
  useSearchUsers,
  useAssignAdmin,
  useUnassignAdmin,
} from "@/hooks/usePlatformAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Building2,
  Check,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Search,
  User,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import ErrorState from "@/components/shared/ErrorState";

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
};

const PlatformApartments = () => {
  const navigate = useNavigate();
  const { data: apartments, isLoading, isError, refetch } = usePlatformApartments();
  const approveApt = useApproveApartment();
  const rejectApt = useRejectApartment();
  const createApt = useCreateApartment();
  const assignAdmin = useAssignAdmin();
  const unassignAdmin = useUnassignAdmin();

  const [tab, setTab] = useState("all");
  const [adminSheet, setAdminSheet] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { data: searchResults } = useSearchUsers(searchTerm);

  // Create apartment state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newLocality, setNewLocality] = useState("");
  const [newPinCode, setNewPinCode] = useState("");
  const [newTotalUnits, setNewTotalUnits] = useState("");

  const handleCreate = async () => {
    if (!newName.trim() || !newCity.trim() || !newLocality.trim()) return;
    try {
      await createApt.mutateAsync({
        name: newName.trim(),
        city: newCity.trim(),
        locality: newLocality.trim(),
        pinCode: newPinCode.trim() || undefined,
        totalUnits: newTotalUnits ? parseInt(newTotalUnits) : undefined,
      });
      toast.success("Apartment created (auto-approved)");
      setShowCreate(false);
      setNewName(""); setNewCity(""); setNewLocality(""); setNewPinCode(""); setNewTotalUnits("");
    } catch {
      toast.error("Failed to create apartment");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveApt.mutateAsync(id);
      toast.success("Apartment approved");
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectApt.mutateAsync(id);
      toast.success("Apartment rejected");
    } catch {
      toast.error("Failed to reject");
    }
  };

  const handleAssign = async (userId: string) => {
    if (!adminSheet) return;
    try {
      await assignAdmin.mutateAsync({ userId, apartmentId: adminSheet });
      toast.success("Admin assigned");
      setAdminSheet(null);
      setSearchTerm("");
    } catch {
      toast.error("Failed to assign admin");
    }
  };

  const handleUnassign = async (userId: string, apartmentId: string) => {
    try {
      await unassignAdmin.mutateAsync({ userId, apartmentId });
      toast.success("Admin unassigned");
    } catch {
      toast.error("Failed to unassign");
    }
  };

  const filtered = (apartments ?? []).filter((a) => {
    if (tab === "pending") return a.status === "pending";
    if (tab === "approved") return a.status === "approved";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Building2 size={22} /> Apartments
        </h2>
        <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Add Apartment
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({apartments?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({apartments?.filter((a) => a.status === "pending").length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No apartments found
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((apt) => (
                <Card key={apt.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className="text-sm font-semibold truncate text-primary cursor-pointer hover:underline"
                          onClick={() => navigate(`/platform/apartments/${apt.id}`)}
                        >{apt.name}</h3>
                        <Badge className={`text-[10px] border-0 ${STATUS_COLORS[apt.status ?? "pending"]}`}>
                          {apt.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin size={12} /> {apt.locality}, {apt.city}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {apt.familyCount} families
                    </span>
                    <span>{apt.providerCount} providers</span>
                    {apt.adminName && (
                      <span className="flex items-center gap-1">
                        <UserCog size={12} /> {apt.adminName}
                      </span>
                    )}
                  </div>

                  {/* Requester details */}
                  {apt.requesterName && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs space-y-0.5">
                      <p className="font-medium text-blue-700 flex items-center gap-1">
                        <User size={11} /> Requested by: {apt.requesterName}
                      </p>
                      {apt.requesterEmail && (
                        <p className="text-blue-600/80">{apt.requesterEmail}</p>
                      )}
                      {apt.requesterPhone && (
                        <p className="text-blue-600/80 flex items-center gap-1">
                          <Phone size={10} /> {apt.requesterPhone}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    {apt.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          className="text-xs gap-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(apt.id)}
                          disabled={approveApt.isPending}
                        >
                          <Check size={14} /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1 text-destructive border-destructive"
                          onClick={() => handleReject(apt.id)}
                          disabled={rejectApt.isPending}
                        >
                          <X size={14} /> Reject
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 ml-auto"
                      onClick={() => {
                        setAdminSheet(apt.id);
                        setSearchTerm("");
                      }}
                    >
                      <UserCog size={14} /> {apt.adminName ? "Change Admin" : "Assign Admin"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Apartment Sheet */}
      <Sheet open={showCreate} onOpenChange={() => setShowCreate(false)}>
        <SheetContent side="bottom" className="rounded-t-2xl md:max-w-lg md:mx-auto">
          <SheetHeader><SheetTitle>Add Apartment</SheetTitle></SheetHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Prestige Lakeside" className="h-10 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">City *</Label>
                <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="e.g., Bangalore" className="h-10 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Locality *</Label>
                <Input value={newLocality} onChange={(e) => setNewLocality(e.target.value)} placeholder="e.g., Whitefield" className="h-10 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Pin Code</Label>
                <Input value={newPinCode} onChange={(e) => setNewPinCode(e.target.value)} placeholder="560066" className="h-10 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total Units</Label>
                <Input type="number" value={newTotalUnits} onChange={(e) => setNewTotalUnits(e.target.value)} placeholder="500" className="h-10 rounded-lg" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Apartment will be auto-approved when added by platform admin.</p>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || !newCity.trim() || !newLocality.trim() || createApt.isPending}
              className="w-full rounded-lg"
            >
              {createApt.isPending ? <Loader2 size={16} className="animate-spin" /> : "Create Apartment"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Assign Admin Sheet */}
      <Sheet open={!!adminSheet} onOpenChange={() => setAdminSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl md:max-w-lg md:mx-auto max-h-[70vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Assign Apartment Admin</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Search by name, email, or phone</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search users..."
                  className="h-10 rounded-lg pl-9"
                />
              </div>
            </div>

            {searchResults && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <Card
                    key={user.id}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-accent"
                    onClick={() => handleAssign(user.id)}
                  >
                    <div>
                      <p className="text-sm font-medium">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email} {user.mobile_number && `· ${user.mobile_number}`}
                      </p>
                    </div>
                    {assignAdmin.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <UserCog size={14} className="text-muted-foreground" />
                    )}
                  </Card>
                ))}
              </div>
            )}

            {searchTerm.length >= 3 && searchResults?.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
            )}

            {/* Current admin info */}
            {adminSheet && (() => {
              const apt = apartments?.find((a) => a.id === adminSheet);
              if (apt?.adminName) {
                return (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Current Admin</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">{apt.adminName}</p>
                        <p className="text-xs text-muted-foreground">{apt.adminEmail}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-destructive"
                        onClick={() => {
                          const admin = (apt as any).apartment_admins?.[0];
                          if (admin) handleUnassign(admin.user_id, apt.id);
                        }}
                      >
                        Unassign
                      </Button>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PlatformApartments;
