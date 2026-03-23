import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Platform-wide Stats ----

export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [apartments, providers, seekers, enrollments] = await Promise.all([
        supabase.from("apartment_complexes").select("id", { count: "exact", head: true }),
        supabase.from("service_providers").select("id", { count: "exact", head: true }),
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);

      return {
        totalApartments: apartments.count ?? 0,
        totalProviders: providers.count ?? 0,
        totalSeekers: seekers.count ?? 0,
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
      const { data, error } = await supabase
        .from("apartment_complexes")
        .select(`
          id, name, city, locality, status, logo_url, created_at,
          apartment_admins(id, user_id, users(full_name, email))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get counts per apartment
      const enriched = await Promise.all(
        (data ?? []).map(async (apt) => {
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
          const admin = (apt.apartment_admins as any)?.[0];
          return {
            ...apt,
            providerCount: provCount.count ?? 0,
            familyCount: famCount.count ?? 0,
            adminName: admin?.users?.full_name ?? null,
            adminEmail: admin?.users?.email ?? null,
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

// ---- Admin Assignment ----

export function useSearchUsers(searchTerm: string) {
  return useQuery({
    queryKey: ["search-users", searchTerm],
    enabled: searchTerm.length >= 2,
    queryFn: async () => {
      const safe = searchTerm.replace(/%/g, "\\%").replace(/_/g, "\\_");
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, mobile_number, avatar_url")
        .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,mobile_number.ilike.%${safe}%`)
        .order("full_name")
        .limit(15);
      if (error) throw error;
      return data;
    },
  });
}

export function useAssignAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, apartmentId }: { userId: string; apartmentId: string }) => {
      // Create apartment_admins row
      const { error: adminErr } = await supabase
        .from("apartment_admins")
        .insert({ user_id: userId, apartment_id: apartmentId });
      if (adminErr) throw adminErr;

      // Mark user as admin
      const { error: userErr } = await supabase
        .from("users")
        .update({ is_apartment_admin: true })
        .eq("id", userId);
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
        await supabase
          .from("users")
          .update({ is_apartment_admin: false })
          .eq("id", userId);
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
    }) => {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.slug !== undefined) payload.slug = updates.slug;
      if (updates.iconName !== undefined) payload.icon_name = updates.iconName;
      if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;
      if (updates.isActive !== undefined) payload.is_active = updates.isActive;

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
      const { data: users } = await supabase
        .from("users")
        .select("id, created_at")
        .order("created_at");

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
