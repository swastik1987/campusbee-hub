import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Platform-wide Stats ----

export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [apartments, providers, userCount, enrollments] = await Promise.all([
        supabase.from("apartment_complexes").select("id", { count: "exact", head: true }),
        supabase.from("service_providers").select("id", { count: "exact", head: true }),
        supabase.rpc("admin_get_user_count"),
        supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);

      return {
        totalApartments: apartments.count ?? 0,
        totalProviders: providers.count ?? 0,
        totalSeekers: (userCount.data as number) ?? 0,
        totalEnrollments: enrollments.count ?? 0,
      };
    },
  });
}

// ---- Apartment Management ----

export function usePlatformApartments() {
  return useQuery({
    queryKey: ["platform-apartments"],
    queryFn: async () => {
      // Use SECURITY DEFINER RPC to get apartments with admin/requester details
      const { data, error } = await supabase.rpc("platform_get_apartments");
      if (error) throw error;

      // Get counts per apartment
      const enriched = await Promise.all(
        (data ?? []).map(async (apt: any) => {
          const [provCount, famCount] = await Promise.all([
            supabase
              .from("provider_apartment_registrations")
              .select("id", { count: "exact", head: true })
              .eq("apartment_id", apt.id)
              .eq("status", "approved"),
            supabase
              .from("families")
              .select("id", { count: "exact", head: true })
              .eq("apartment_id", apt.id),
          ]);
          return {
            ...apt,
            providerCount: provCount.count ?? 0,
            familyCount: famCount.count ?? 0,
            adminName: apt.admin_name ?? null,
            adminEmail: apt.admin_email ?? null,
            adminPhone: apt.admin_phone ?? null,
            adminUserId: apt.admin_user_id ?? null,
            requesterName: apt.requester_name ?? null,
            requesterEmail: apt.requester_email ?? null,
            requesterPhone: apt.requester_phone ?? null,
          };
        })
      );

      return enriched;
    },
  });
}

export function useApproveApartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (apartmentId: string) => {
      const { error } = await supabase
        .from("apartment_complexes")
        .update({ status: "approved" })
        .eq("id", apartmentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-apartments"] }),
  });
}

export function useRejectApartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (apartmentId: string) => {
      const { error } = await supabase
        .from("apartment_complexes")
        .update({ status: "rejected" })
        .eq("id", apartmentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-apartments"] }),
  });
}

export function useCreateApartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      city: string;
      locality: string;
      pinCode?: string;
      totalUnits?: number;
    }) => {
      const { error } = await supabase.from("apartment_complexes").insert({
        name: input.name,
        city: input.city,
        locality: input.locality,
        pin_code: input.pinCode || null,
        total_units: input.totalUnits || null,
        status: "approved", // Auto-approved when created by platform admin
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-apartments"] }),
  });
}

// ---- Admin Assignment ----

export function useSearchUsers(searchTerm: string) {
  return useQuery({
    queryKey: ["search-users", searchTerm],
    enabled: searchTerm.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_search_users", {
        search_query: searchTerm,
      });
      if (error) throw error;
      return data as { id: string; full_name: string; email: string; mobile_number: string; avatar_url: string }[];
    },
  });
}

export function useAssignAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, apartmentId }: { userId: string; apartmentId: string }) => {
      // Delete existing admin for this apartment first (UNIQUE constraint on apartment_id)
      await supabase
        .from("apartment_admins")
        .delete()
        .eq("apartment_id", apartmentId);

      // Create apartment_admins row
      const { error: adminErr } = await supabase
        .from("apartment_admins")
        .insert({ user_id: userId, apartment_id: apartmentId });
      if (adminErr) throw adminErr;

      // Mark user as admin via RPC (bypasses users RLS)
      const { error: userErr } = await supabase.rpc("admin_update_user", {
        target_user_id: userId,
        set_apartment_admin: true,
      });
      if (userErr) throw userErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-apartments"] });
      qc.invalidateQueries({ queryKey: ["search-users"] });
    },
  });
}

export function useUnassignAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, apartmentId }: { userId: string; apartmentId: string }) => {
      const { error } = await supabase
        .from("apartment_admins")
        .delete()
        .eq("user_id", userId)
        .eq("apartment_id", apartmentId);
      if (error) throw error;

      // Check if user is still admin of any other apartment
      const { count } = await supabase
        .from("apartment_admins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) === 0) {
        await supabase.rpc("admin_update_user", {
          target_user_id: userId,
          set_apartment_admin: false,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-apartments"] }),
  });
}

// ---- Category Management ----

export function usePlatformCategories() {
  return useQuery({
    queryKey: ["platform-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_categories")
        .select("id, name, slug, icon_name, parent_category_id, display_order, is_active")
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      slug: string;
      iconName?: string;
      parentCategoryId?: string;
      displayOrder?: number;
    }) => {
      const { error } = await supabase.from("class_categories").insert({
        name: input.name,
        slug: input.slug,
        icon_name: input.iconName || null,
        parent_category_id: input.parentCategoryId || null,
        display_order: input.displayOrder ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      name?: string;
      slug?: string;
      iconName?: string;
      displayOrder?: number;
      isActive?: boolean;
      parentCategoryId?: string | null;
    }) => {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.slug !== undefined) payload.slug = updates.slug;
      if (updates.iconName !== undefined) payload.icon_name = updates.iconName;
      if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;
      if (updates.isActive !== undefined) payload.is_active = updates.isActive;
      if (updates.parentCategoryId !== undefined) payload.parent_category_id = updates.parentCategoryId;

      const { error } = await supabase
        .from("class_categories")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-categories"] }),
  });
}

// ---- Platform Growth Analytics ----

export function usePlatformGrowth(months: number = 6) {
  return useQuery({
    queryKey: ["platform-growth", months],
    queryFn: async () => {
      const { data: users } = await supabase.rpc("admin_get_users_growth");

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("id, created_at")
        .order("created_at");

      const now = new Date();
      const growth: { month: string; users: number; enrollments: number }[] = [];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        const monthKey = d.toISOString().slice(0, 7);

        const userCount = (users ?? []).filter(
          (u) => u.created_at && u.created_at.slice(0, 7) === monthKey
        ).length;
        const enrollCount = (enrollments ?? []).filter(
          (e) => e.created_at && e.created_at.slice(0, 7) === monthKey
        ).length;

        growth.push({ month: label, users: userCount, enrollments: enrollCount });
      }

      // City-wise breakdown
      const { data: apartments } = await supabase
        .from("apartment_complexes")
        .select("id, city")
        .eq("status", "approved");

      const cityMap: Record<string, number> = {};
      for (const apt of apartments ?? []) {
        cityMap[apt.city] = (cityMap[apt.city] ?? 0) + 1;
      }
      const cityBreakdown = Object.entries(cityMap)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count);

      return { growth, cityBreakdown };
    },
  });
}
