import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Attendance (Provider) ----

export function useBatchEnrolledStudents(batchId: string | undefined, date?: string) {
  const today = new Date().toISOString().split("T")[0];
  const isPast = !!date && date < today;

  return useQuery({
    queryKey: ["batch-students", batchId, date],
    enabled: !!batchId,
    queryFn: async () => {
      let query = supabase
        .from("enrollments")
        .select(`
          id, status, enrolled_at, dropped_at, approved_at,
          family_members(id, full_name, relationship, avatar_url)
        `)
        .eq("batch_id", batchId!)
        .order("created_at");

      if (isPast) {
        // For past dates: include students who were enrolled on that date
        query = query
          .in("status", ["active", "completed", "dropped", "paused"])
          .lte("enrolled_at", `${date}T23:59:59`);
      } else {
        // For today: only currently active students
        query = query.eq("status", "active");
      }

      const { data, error } = await query;
      if (error) throw error;

      if (isPast && data) {
        // Filter out students who were dropped before the target date
        return data.filter((e) => {
          if (e.status === "dropped" && e.dropped_at) {
            return e.dropped_at.split("T")[0] >= date!;
          }
          return true;
        });
      }

      return data;
    },
  });
}

export function useBatchAttendanceForDate(batchId: string | undefined, date: string) {
  return useQuery({
    queryKey: ["batch-attendance", batchId, date],
    enabled: !!batchId && !!date,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, enrollment_id, status, notes")
        .eq("batch_id", batchId!)
        .eq("session_date", date);
      if (error) throw error;
      return data;
    },
  });
}

export function useSubmitAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batchId: string;
      date: string;
      markedBy: string;
      records: { enrollmentId: string; status: string }[];
    }) => {
      const rows = input.records.map((r) => ({
        enrollment_id: r.enrollmentId,
        batch_id: input.batchId,
        session_date: input.date,
        status: r.status,
        marked_by: input.markedBy,
      }));

      // Delete existing records for this batch/date first, then insert
      await supabase
        .from("attendance_records")
        .delete()
        .eq("batch_id", input.batchId)
        .eq("session_date", input.date);

      const { error } = await supabase.from("attendance_records").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batch-attendance"] });
      qc.invalidateQueries({ queryKey: ["enrollment-attendance"] });
    },
  });
}

// ---- Provider: Enrollment management ----

export function useProviderEnrollments(batchIds: string[], status?: string) {
  return useQuery({
    queryKey: ["provider-enrollments", batchIds, status],
    enabled: batchIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from("enrollments")
        .select(`
          id, batch_id, family_member_id, enrolled_by, status, enrolled_at, approved_at, dropped_at, notes, created_at,
          batches(id, batch_name, class_id, fee_amount, fee_frequency, start_date, end_date, status, max_batch_size, current_enrollment_count,
            classes(id, title),
            batch_schedules(day_of_week, start_time, end_time)
          ),
          payments(id, amount, status, upi_transaction_id, paid_at, payment_type)
        `)
        .in("batch_id", batchIds)
        .order("created_at", { ascending: false });

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/** Returns dropped enrollments where the family member was soft-deleted (deleted_at IS NOT NULL). */
export function useRemovedEnrollments(batchIds: string[]) {
  return useQuery({
    queryKey: ["removed-enrollments", batchIds],
    enabled: batchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          id, batch_id, family_member_id, enrolled_by, status, enrolled_at, dropped_at, drop_reason, created_at,
          batches(id, batch_name, class_id, fee_amount, fee_frequency,
            classes(id, title),
            batch_schedules(day_of_week, start_time, end_time)
          )
        `)
        .in("batch_id", batchIds)
        .eq("status", "dropped")
        .order("dropped_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      // Return all dropped enrollments; names/deleted_at fetched via RPC
      return data ?? [];
    },
  });
}

export interface StudentNameEntry {
  enrollment_id: string;
  student_name: string | null;
  student_relation: string | null;
  student_dob: string | null;
  student_age_grp: string | null;
  seeker_id: string | null;
  seeker_name: string | null;
  seeker_avatar: string | null;
}

/** Fetches student + seeker names via a SECURITY DEFINER RPC (bypasses RLS). */
export function useProviderStudentNames(batchIds: string[]) {
  return useQuery({
    queryKey: ["provider-student-names", batchIds],
    enabled: batchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_provider_student_names", {
        p_batch_ids: batchIds,
      });
      if (error) throw error;
      return (data ?? []) as StudentNameEntry[];
    },
  });
}

export function useUpdateEnrollmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ enrollmentId, status }: { enrollmentId: string; status: string }) => {
      const updates: any = { status };
      if (status === "active") updates.approved_at = new Date().toISOString();
      if (status === "dropped") {
        updates.dropped_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("enrollments")
        .update(updates)
        .eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-enrollments"] });
      qc.invalidateQueries({ queryKey: ["pending-enrollments"] });
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      // Refresh batch seat counts on both provider and seeker views
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["seeker-class-detail"] });
      qc.invalidateQueries({ queryKey: ["enroll-batch"] });
    },
  });
}

// ---- Learner drop & batch switch ----

const invalidateEnrollmentCaches = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["my-enrollments"] });
  qc.invalidateQueries({ queryKey: ["enrollment-detail"] });
  qc.invalidateQueries({ queryKey: ["provider-enrollments"] });
  qc.invalidateQueries({ queryKey: ["pending-enrollments"] });
  qc.invalidateQueries({ queryKey: ["pending-batch-switches"] });
  qc.invalidateQueries({ queryKey: ["batches"] });
  qc.invalidateQueries({ queryKey: ["seeker-class-detail"] });
};

export function useLearnerDropEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await (supabase as any).rpc("learner_drop_enrollment", {
        p_enrollment_id: enrollmentId,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateEnrollmentCaches(qc),
  });
}

export function useLearnerRequestBatchSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      enrollmentId: string;
      toBatchId: string;
      reason?: string;
    }) => {
      const { error } = await (supabase as any).rpc("learner_request_batch_switch", {
        p_enrollment_id: args.enrollmentId,
        p_to_batch_id: args.toBatchId,
        p_reason: args.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateEnrollmentCaches(qc),
  });
}

export function useLearnerCancelBatchSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await (supabase as any).rpc("learner_cancel_batch_switch", {
        p_enrollment_id: enrollmentId,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateEnrollmentCaches(qc),
  });
}

export function useProviderApproveBatchSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await (supabase as any).rpc("provider_approve_batch_switch", {
        p_enrollment_id: enrollmentId,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateEnrollmentCaches(qc),
  });
}

export function useProviderRejectBatchSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { enrollmentId: string; reason?: string }) => {
      const { error } = await (supabase as any).rpc("provider_reject_batch_switch", {
        p_enrollment_id: args.enrollmentId,
        p_reason: args.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateEnrollmentCaches(qc),
  });
}

/** Pending batch-switch requests across this provider's classes — for the dashboard inbox. */
export function usePendingBatchSwitches(providerId: string | undefined) {
  return useQuery({
    queryKey: ["pending-batch-switches", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      // 1. Provider's class ids
      const { data: classes, error: cErr } = await supabase
        .from("classes")
        .select("id, title")
        .eq("provider_id", providerId!);
      if (cErr) throw cErr;
      const classIds = (classes ?? []).map((c) => c.id);
      if (classIds.length === 0) return [];

      // 2. Batch ids in those classes
      const { data: batches, error: bErr } = await supabase
        .from("batches")
        .select("id, batch_name, class_id")
        .in("class_id", classIds);
      if (bErr) throw bErr;
      const batchIds = (batches ?? []).map((b) => b.id);
      if (batchIds.length === 0) return [];

      // 3. Enrollments in those batches with a pending switch
      const { data: enrolls, error: eErr } = await (supabase as any)
        .from("enrollments")
        .select(
          "id, batch_id, pending_switch_to_batch_id, switch_requested_at, family_member_id, enrolled_by",
        )
        .in("batch_id", batchIds)
        .not("pending_switch_to_batch_id", "is", null)
        .order("switch_requested_at", { ascending: false });
      if (eErr) throw eErr;

      const rows = enrolls ?? [];
      if (rows.length === 0) return [];

      // 4. Resolve names for from/to batches + classes + students
      const batchMap = new Map(batches!.map((b) => [b.id, b]));
      const classMap = new Map(classes!.map((c) => [c.id, c]));

      // Target batches may live in other classes belonging to the same provider;
      // they should already be in `batches` because we filtered by all provider classes.
      const memberIds = Array.from(
        new Set(rows.map((r: any) => r.family_member_id).filter(Boolean)),
      ) as string[];
      const { data: members } = memberIds.length
        ? await supabase
            .from("family_members")
            .select("id, full_name")
            .in("id", memberIds)
        : { data: [] as any[] };
      const memberMap = new Map((members ?? []).map((m: any) => [m.id, m.full_name]));

      return rows.map((r: any) => {
        const fromBatch = batchMap.get(r.batch_id);
        const toBatch = batchMap.get(r.pending_switch_to_batch_id);
        const cls = fromBatch ? classMap.get(fromBatch.class_id) : undefined;
        return {
          enrollmentId: r.id as string,
          classTitle: cls?.title ?? "",
          fromBatchName: fromBatch?.batch_name ?? "",
          toBatchName: toBatch?.batch_name ?? "",
          memberName: memberMap.get(r.family_member_id) ?? "A student",
          requestedAt: r.switch_requested_at as string | null,
        };
      });
    },
  });
}

// ---- Provider: Payment management ----

export function useProviderPayments(providerId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ["provider-payments", providerId, status],
    enabled: !!providerId,
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select(`
          id, amount, payment_type, payment_method, upi_transaction_id,
          status, paid_at, receipt_url, payment_period_start, payment_period_end,
          notes, created_at,
          enrollments(id,
            family_members(full_name, relationship),
            batches(batch_name, classes(title))
          ),
          users!payments_payer_user_id_fkey(full_name, avatar_url)
        `)
        .eq("provider_id", providerId!)
        .order("created_at", { ascending: false });

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, confirmedBy }: { paymentId: string; confirmedBy: string }) => {
      const { error } = await supabase
        .from("payments")
        .update({
          status: "confirmed",
          confirmed_by: confirmedBy,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-payments"] });
      qc.invalidateQueries({ queryKey: ["enrollment-payments"] });
      qc.invalidateQueries({ queryKey: ["provider-stats"] });
    },
  });
}

export function useDisputePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, notes }: { paymentId: string; notes: string }) => {
      const { error } = await supabase
        .from("payments")
        .update({ status: "disputed", notes })
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-payments"] });
      qc.invalidateQueries({ queryKey: ["enrollment-payments"] });
    },
  });
}

// ---- Chat ----

export function useChatConversations(userId: string | undefined) {
  return useQuery({
    queryKey: ["chat-conversations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select(`
          id, participant_1, participant_2, last_message_at, last_message_preview,
          user1:users!chat_conversations_participant_1_fkey(id, full_name, avatar_url, is_provider),
          user2:users!chat_conversations_participant_2_fkey(id, full_name, avatar_url, is_provider)
        `)
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUnreadChatCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["unread-chat-count", userId],
    enabled: !!userId,
    refetchInterval: 30000,
    queryFn: async () => {
      // Step 1: get conversation IDs the user participates in
      const { data: convs, error: convErr } = await supabase
        .from("chat_conversations")
        .select("id")
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
      if (convErr) throw convErr;
      const convIds = (convs ?? []).map((c: any) => c.id);
      if (convIds.length === 0) return 0;
      // Step 2: count unread messages where the user is NOT the sender
      const { count, error } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .neq("sender_id", userId!)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Returns a Map of conversationId → unread count (for the receiver). */
export function useUnreadCountsByConversation(userId: string | undefined) {
  return useQuery({
    queryKey: ["unread-counts-by-conv", userId],
    enabled: !!userId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("conversation_id")
        .neq("sender_id", userId!)
        .eq("is_read", false);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const cid = (row as { conversation_id: string }).conversation_id;
        counts.set(cid, (counts.get(cid) ?? 0) + 1);
      }
      return counts;
    },
  });
}

/** Marks every unread message in a conversation (where I'm the receiver) as read. */
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase.rpc("mark_conversation_read", {
        p_conversation_id: conversationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unread-chat-count"] });
      qc.invalidateQueries({ queryKey: ["unread-counts-by-conv"] });
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });
}

export function useChatMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["chat-messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, conversation_id, sender_id, body, message_type, is_read, created_at")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Poll every 5s for new messages
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      senderId: string;
      messageText: string;
    }) => {
      const { error: msgErr } = await supabase.from("chat_messages").insert({
        conversation_id: input.conversationId,
        sender_id: input.senderId,
        body: input.messageText,
      });
      if (msgErr) throw msgErr;

      // Update conversation preview
      await supabase
        .from("chat_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: input.messageText.slice(0, 100),
        })
        .eq("id", input.conversationId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
      qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useGetOrCreateConversation() {
  return useMutation({
    mutationFn: async ({ userId, otherUserId }: { userId: string; otherUserId: string }) => {
      // Check existing
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("id")
        .or(
          `and(participant_1.eq.${userId},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${userId})`
        )
        .maybeSingle();

      if (existing) return existing.id;

      // Create new
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({ participant_1: userId, participant_2: otherUserId, participant_ids: [userId, otherUserId] })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
  });
}

// ---- Announcements ----

export function useAnnouncements(filters: {
  apartmentId?: string; // kept for API compat; ignored in v2 (no apartment column)
  classId?: string;
  batchId?: string;
}) {
  return useQuery({
    queryKey: ["announcements", filters],
    enabled: !!(filters.classId || filters.batchId),
    queryFn: async () => {
      let query = supabase
        .from("announcements")
        .select(`
          id, title, body, announcement_type, target_audience, is_pinned, created_at,
          users!announcements_author_id_fkey(full_name, avatar_url)
        `)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters.classId) {
        query = query.eq("class_id", filters.classId);
      }
      if (filters.batchId) {
        query = query.eq("batch_id", filters.batchId);
      }

      const { data, error } = await query.limit(30);
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      authorId: string;
      providerId: string;
      apartmentId?: string; // kept for API compat; ignored in v2
      classId?: string;
      batchId?: string;
      targetAudience: string;
      title: string;
      body: string;
      announcementType: string;
      isPinned: boolean;
    }) => {
      const { error } = await supabase.from("announcements").insert({
        provider_id: input.providerId,
        author_id: input.authorId,
        class_id: input.classId || null,
        batch_id: input.batchId || null,
        target_audience: input.targetAudience,
        title: input.title,
        body: input.body,
        announcement_type: input.announcementType,
        is_pinned: input.isPinned,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

// ---- Reviews (Provider side) ----

export function useProviderReviews(classIds: string[]) {
  return useQuery({
    queryKey: ["provider-reviews", classIds],
    enabled: classIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          id, class_id, rating, review_text, is_verified, provider_reply,
          provider_replied_at, created_at,
          users(full_name, avatar_url),
          classes(title)
        `)
        .in("class_id", classIds)
        .eq("is_visible", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useReplyToReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, reply }: { reviewId: string; reply: string }) => {
      const { error } = await supabase
        .from("reviews")
        .update({
          provider_reply: reply,
          provider_replied_at: new Date().toISOString(),
        })
        .eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-reviews"] });
      qc.invalidateQueries({ queryKey: ["class-reviews"] });
    },
  });
}
