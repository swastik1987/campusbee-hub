import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useAdminResidents } from "@/hooks/useAdmin";
import { useCategories } from "@/hooks/useClasses";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Home,
  Search,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import ErrorState from "@/components/shared/ErrorState";

const AdminResidents = () => {
  const navigate = useNavigate();
  const { currentApartment } = useUser();
  const aptId = currentApartment?.id;
  const { data, isLoading, isError, refetch } = useAdminResidents(aptId);
  const { data: categories } = useCategories();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);

  // Build category and provider lists from enrollments
  const parentCategories = useMemo(
    () => (categories ?? []).filter((c) => !c.parent_category_id),
    [categories]
  );

  const allSubCategories = useMemo(
    () => (categories ?? []).filter((c) => c.parent_category_id),
    [categories]
  );

  // Get unique providers from enrollments
  const uniqueProviders = useMemo(() => {
    const map = new Map<string, string>();
    (data?.enrollments ?? []).forEach((e: any) => {
      const prov = e.batches?.classes?.provider_apartment_registrations;
      const sp = prov?.service_providers;
      if (sp) {
        const provId = prov.provider_id;
        const name = sp.business_name || sp.users?.full_name || "Provider";
        if (provId) map.set(provId, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data?.enrollments]);

  // Build enrollment lookup by family member ID
  const enrollmentsByMember = useMemo(() => {
    const map = new Map<string, any[]>();
    (data?.enrollments ?? []).forEach((e: any) => {
      const arr = map.get(e.family_member_id) || [];
      arr.push(e);
      map.set(e.family_member_id, arr);
    });
    return map;
  }, [data?.enrollments]);

  // Filter families
  const filteredFamilies = useMemo(() => {
    return (data?.families ?? []).filter((fam: any) => {
      const user = fam.users;
      const members = (fam.family_members as any[]) ?? [];

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const nameMatch = user?.full_name?.toLowerCase().includes(term);
        const flatMatch = fam.flat_number?.toLowerCase().includes(term);
        const blockMatch = fam.block_tower?.toLowerCase().includes(term);
        const memberMatch = members.some((m: any) => m.name?.toLowerCase().includes(term));
        if (!nameMatch && !flatMatch && !blockMatch && !memberMatch) return false;
      }

      // Category / Provider filter — check if any member has a matching enrollment
      if (categoryFilter !== "all" || providerFilter !== "all") {
        const hasMatch = members.some((m: any) => {
          const memberEnrollments = enrollmentsByMember.get(m.id) || [];
          return memberEnrollments.some((e: any) => {
            const cls = e.batches?.classes;
            if (!cls) return false;

            // Category filter
            if (categoryFilter !== "all") {
              const catId = cls.category_id;
              // Check if matches parent or sub category
              const isParent = catId === categoryFilter;
              const isChild = allSubCategories.some(
                (sc) => sc.id === catId && sc.parent_category_id === categoryFilter
              );
              if (!isParent && !isChild) return false;
            }

            // Provider filter
            if (providerFilter !== "all") {
              const provId = cls.provider_apartment_registrations?.provider_id;
              if (provId !== providerFilter) return false;
            }

            return true;
          });
        });
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [data?.families, searchTerm, categoryFilter, providerFilter, enrollmentsByMember, allSubCategories]);

  const getCategoryName = (catId: string) => {
    const cat = (categories ?? []).find((c) => c.id === catId);
    return cat?.name ?? "";
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/dashboard")} className="p-1">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Users size={18} /> Residents
          </h2>
          <Badge variant="secondary" className="ml-auto text-xs">
            {filteredFamilies.length} families
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, flat, block..."
            className="h-10 rounded-xl pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="flex-1 h-9 rounded-lg text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {parentCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="flex-1 h-9 rounded-lg text-xs">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              {uniqueProviders.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Family List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : filteredFamilies.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Home size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No residents found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFamilies.map((fam: any) => {
              const user = fam.users;
              const members = ((fam.family_members as any[]) ?? []).filter((m: any) => m.is_active);
              const isExpanded = expandedFamily === fam.id;

              // Count total enrollments for this family
              const totalEnrollments = members.reduce((sum: number, m: any) => {
                return sum + (enrollmentsByMember.get(m.id)?.length ?? 0);
              }, 0);

              return (
                <Card key={fam.id} className="overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50"
                    onClick={() => setExpandedFamily(isExpanded ? null : fam.id)}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user?.avatar_url} />
                      <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                        {user?.full_name?.charAt(0) ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{user?.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {fam.block_tower && `${fam.block_tower} · `}Flat {fam.flat_number} · {members.length} member{members.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalEnrollments > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {totalEnrollments} enrolled
                        </Badge>
                      )}
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t bg-muted/30 px-3 py-2 space-y-3">
                      {/* Contact info */}
                      <div className="text-[11px] text-muted-foreground space-y-0.5">
                        {user?.email && <p>Email: {user.email}</p>}
                        {user?.mobile_number && <p>Phone: {user.mobile_number}</p>}
                      </div>

                      {/* Members & their enrollments */}
                      {members.map((member: any) => {
                        const memberEnrollments = enrollmentsByMember.get(member.id) || [];
                        return (
                          <div key={member.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold">{member.name}</p>
                              {member.relationship && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1">
                                  {member.relationship}
                                </Badge>
                              )}
                              {member.age_group && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1">
                                  {member.age_group}
                                </Badge>
                              )}
                            </div>
                            {memberEnrollments.length > 0 ? (
                              <div className="pl-2 space-y-1">
                                {memberEnrollments.map((e: any) => {
                                  const cls = e.batches?.classes;
                                  const prov = cls?.provider_apartment_registrations?.service_providers;
                                  const provName = prov?.business_name || prov?.users?.full_name || "";
                                  const statusColor =
                                    e.status === "active" ? "bg-green-100 text-green-700" :
                                    e.status === "pending" ? "bg-amber-100 text-amber-700" :
                                    "bg-gray-100 text-gray-600";
                                  return (
                                    <div key={e.id} className="flex items-center gap-2 text-[11px]">
                                      <Badge className={`text-[9px] border-0 h-4 px-1 ${statusColor}`}>
                                        {e.status}
                                      </Badge>
                                      <span className="font-medium truncate">{cls?.title}</span>
                                      {cls?.category_id && (
                                        <span className="text-muted-foreground">· {getCategoryName(cls.category_id)}</span>
                                      )}
                                      {provName && (
                                        <span className="text-muted-foreground ml-auto text-[10px] truncate max-w-[80px]">
                                          {provName}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground pl-2">No enrollments</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav persona="admin" />
    </div>
  );
};

export default AdminResidents;
