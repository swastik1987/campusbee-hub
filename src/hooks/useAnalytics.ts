import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Revenue Analytics ----

export function useProviderRevenue(providerId: string | undefined, months: number = 6) {
  return useQuery({
    queryKey: ["provider-revenue", providerId, months],
    enabled: !!providerId,
    queryFn: async () => {
      const { data: payments, error } = await supabase
        .from("payments")
        .select("id, amount, status, payment_type, paid_at, created_at, enrollment_id, enrollments(batch_id, batches(class_id, classes(title)))")
        .eq("provider_id", providerId!)
        .eq("status", "confirmed")
        .order("paid_at", { ascending: false });
      if (error) throw error;

      // Build monthly revenue for last N months
      const now = new Date();
      const monthlyRevenue: { month: string; revenue: number }[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        const monthStart = d.toISOString().slice(0, 7); // YYYY-MM
        const total = (payments ?? [])
          .filter((p) => p.paid_at && p.paid_at.slice(0, 7) === monthStart)
          .reduce((sum, p) => sum + Number(p.amount), 0);
        monthlyRevenue.push({ month: label, revenue: total });
      }

      // Revenue by class
      const byClass: Record<string, { title: string; revenue: number }> = {};
      for (const p of payments ?? []) {
        const enrollment = p.enrollments as any;
        const classTitle = enrollment?.batches?.classes?.title ?? "Unknown";
        const classId = enrollment?.batches?.class_id ?? "unknown";
        if (!byClass[classId]) byClass[classId] = { title: classTitle, revenue: 0 };
        byClass[classId].revenue += Number(p.amount);
      }

      const totalRevenue = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const avgPerMonth = months > 0 ? totalRevenue / months : 0;

      return {
        monthlyRevenue,
        revenueByClass: Object.values(byClass).sort((a, b) => b.revenue - a.revenue),
        totalRevenue,
        avgPerMonth,
      };
    },
  });
}

// ---- Student / Enrollment Analytics ----

export function useProviderStudentAnalytics(providerId: string | undefined, apartmentRegIds: string[], months: number = 6) {
  return useQuery({
    queryKey: ["provider-student-analytics", providerId, apartmentRegIds, months],
    enabled: !!providerId && apartmentRegIds.length > 0,
    queryFn: async () => {
      // Get class IDs
      const { data: classes } = await supabase
        .from("classes")
        .select("id, title")
        .in("provider_registration_id", apartmentRegIds);
      const classIds = classes?.map((c) => c.id) ?? [];
      if (classIds.length === 0) return { totalStudents: 0, newThisMonth: 0, byClass: [], enrollmentTrend: [] };

      const { data: batches } = await supabase
        .from("batches")
        .select("id, class_id")
        .in("class_id", classIds);
      const batchIds = batches?.map((b) => b.id) ?? [];
      if (batchIds.length === 0) return { totalStudents: 0, newThisMonth: 0, byClass: [], enrollmentTrend: [] };

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("id, batch_id, status, enrolled_at, created_at")
        .in("batch_id", batchIds);

      const activeEnrollments = (enrollments ?? []).filter((e) => e.status === "active");
      const totalStudents = activeEnrollments.length;

      // New this month
      const thisMonth = new Date().toISOString().slice(0, 7);
      const newThisMonth = (enrollments ?? []).filter(
        (e) => e.enrolled_at && e.enrolled_at.slice(0, 7) === thisMonth
      ).length;

      // By class
      const byClass: Record<string, { title: string; count: number }> = {};
      for (const e of activeEnrollments) {
        const batch = batches?.find((b) => b.id === e.batch_id);
        const cls = classes?.find((c) => c.id === batch?.class_id);
        const cid = batch?.class_id ?? "unknown";
        if (!byClass[cid]) byClass[cid] = { title: cls?.title ?? "Unknown", count: 0 };
        byClass[cid].count++;
      }

      // Enrollment trend (last N months)
      const now = new Date();
      const enrollmentTrend: { month: string; count: number }[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        const monthKey = d.toISOString().slice(0, 7);
        const count = (enrollments ?? []).filter(
          (e) => e.enrolled_at && e.enrolled_at.slice(0, 7) === monthKey
        ).length;
        enrollmentTrend.push({ month: label, count });
      }

      return {
        totalStudents,
        newThisMonth,
        byClass: Object.values(byClass).sort((a, b) => b.count - a.count),
        enrollmentTrend,
      };
    },
  });
}

// ---- Attendance Analytics ----

export function useProviderAttendanceAnalytics(providerId: string | undefined, apartmentRegIds: string[]) {
  return useQuery({
    queryKey: ["provider-attendance-analytics", providerId, apartmentRegIds],
    enabled: !!providerId && apartmentRegIds.length > 0,
    queryFn: async () => {
      const { data: classes } = await supabase
        .from("classes")
        .select("id, title")
        .in("provider_registration_id", apartmentRegIds);
      const classIds = classes?.map((c) => c.id) ?? [];
      if (classIds.length === 0) return { averageRate: 0, byBatch: [], lowAttendance: [] };

      const { data: batches } = await supabase
        .from("batches")
        .select("id, batch_name, class_id")
        .in("class_id", classIds)
        .in("status", ["active", "full"]);
      const batchIds = batches?.map((b) => b.id) ?? [];
      if (batchIds.length === 0) return { averageRate: 0, byBatch: [], lowAttendance: [] };

      const { data: records } = await supabase
        .from("attendance_records")
        .select("id, enrollment_id, batch_id, status")
        .in("batch_id", batchIds);

      const allRecords = records ?? [];
      const totalPresent = allRecords.filter((r) => r.status === "present" || r.status === "late").length;
      const averageRate = allRecords.length > 0 ? Math.round((totalPresent / allRecords.length) * 100) : 0;

      // By batch
      const byBatch: { batchName: string; className: string; rate: number; total: number }[] = [];
      for (const batch of batches ?? []) {
        const batchRecords = allRecords.filter((r) => r.batch_id === batch.id);
        const present = batchRecords.filter((r) => r.status === "present" || r.status === "late").length;
        const rate = batchRecords.length > 0 ? Math.round((present / batchRecords.length) * 100) : 0;
        const cls = classes?.find((c) => c.id === batch.class_id);
        byBatch.push({
          batchName: batch.batch_name,
          className: cls?.title ?? "",
          rate,
          total: batchRecords.length,
        });
      }
      byBatch.sort((a, b) => a.rate - b.rate);

      // Low attendance students (below 50%)
      const enrollmentStats: Record<string, { present: number; total: number; enrollmentId: string }> = {};
      for (const r of allRecords) {
        if (!enrollmentStats[r.enrollment_id]) {
          enrollmentStats[r.enrollment_id] = { present: 0, total: 0, enrollmentId: r.enrollment_id };
        }
        enrollmentStats[r.enrollment_id].total++;
        if (r.status === "present" || r.status === "late") {
          enrollmentStats[r.enrollment_id].present++;
        }
      }

      const lowAttendance = Object.values(enrollmentStats)
        .filter((s) => s.total >= 3 && (s.present / s.total) < 0.5)
        .map((s) => ({
          enrollmentId: s.enrollmentId,
          rate: Math.round((s.present / s.total) * 100),
          sessions: s.total,
        }));

      return { averageRate, byBatch, lowAttendance };
    },
  });
}

// ---- Payment Collection Analytics ----

export function useProviderCollectionAnalytics(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-collection-analytics", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data: payments, error } = await supabase
        .from("payments")
        .select("id, amount, status, due_date, paid_at, created_at, enrollment_id, enrollments(family_members(name, relationship))")
        .eq("provider_id", providerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const all = payments ?? [];
      const confirmed = all.filter((p) => p.status === "confirmed");
      const pending = all.filter((p) => p.status === "recorded");
      const overdue = all.filter((p) => {
        if (p.status !== "recorded" && p.status !== "pending") return false;
        if (!p.due_date) return false;
        return new Date(p.due_date) < new Date();
      });

      const totalDue = all.reduce((s, p) => s + Number(p.amount), 0);
      const totalCollected = confirmed.reduce((s, p) => s + Number(p.amount), 0);
      const collectionRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

      const overdueList = overdue.map((p) => ({
        paymentId: p.id,
        amount: Number(p.amount),
        dueDate: p.due_date,
        memberName: (p.enrollments as any)?.family_members?.name ?? "Unknown",
        relationship: (p.enrollments as any)?.family_members?.relationship ?? "",
      }));

      return {
        totalDue,
        totalCollected,
        collectionRate,
        pendingCount: pending.length,
        pendingAmount: pending.reduce((s, p) => s + Number(p.amount), 0),
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((s, p) => s + Number(p.amount), 0),
        overdueList,
      };
    },
  });
}
