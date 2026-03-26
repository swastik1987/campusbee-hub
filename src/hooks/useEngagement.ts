import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Attendance (Provider) ----

export function useBatchEnrolledStudents(batchId: string | undefined) {
  return useQuery({
    queryKey: ["batch-students", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          id, status,
          family_members(id, name, relationship, avatar_url)
        `)
        .eq("batch_id", batchId!)
        .eq("status", "active")
        .order("created_at");
      if (error) throw error;
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
      // Upsert attendance records
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
          id, batch_id, family_member_id, enrolled_by, status, enrolled_at, approved_at, notes, created_at,
          family_members(id, name, relationship, avatar_url, date_of_birth, age_group,
            families(flat_number, block_tower)
          ),
          batches(id, batch_name, class_id, fee_amount, fee_frequency, start_date, end_date, status,
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
          enrollments(id, family_members(name, relationship),
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
          user1:users!chat_conversations_participant_1_fkey(id, full_name, avatar_url, families(flat_number, block_tower)),
          user2:users!chat_conversations_participant_2_fkey(id, full_name, avatar_url, families(flat_number, block_tower))
        `)
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
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
        .select("id, conversation_id, sender_id, message_text, message_type, is_read, created_at")
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
        message_text: input.messageText,
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
        .insert({ participant_1: userId, participant_2: otherUserId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
  });
}

// ---- Announcements ----

export function useAnnouncements(filters: {
  apartmentId?: string;
  classId?: string;
  batchId?: string;
}) {
  return useQuery({
    queryKey: ["announcements", filters],
    enabled: !!(filters.apartmentId || filters.classId || filters.batchId),
    queryFn: async () => {
      let query = supabase
        .from("announcements")
        .select(`
          id, title, body, announcement_type, target_audience, is_pinned, created_at,
          users(full_name, avatar_url)
        `)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters.apartmentId) {
        query = query.eq("apartment_id", filters.apartmentId);
      }
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
      apartmentId?: string;
      classId?: string;
      batchId?: string;
      targetAudience: string;
      title: string;
      body: string;
      announcementType: string;
      isPinned: boolean;
    }) => {
      const { error } = await supabase.from("announcements").insert({
        author_id: input.authorId,
        apartment_id: input.apartmentId || null,
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
