import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Provider: manage demo sessions ----

export function useDemoSessions(classId: string | undefined) {
  return useQuery({
    queryKey: ["demo-sessions", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_sessions")
        .select("id, class_id, session_date, start_time, end_time, max_participants, current_count, fee, status, notes, created_at")
        .eq("class_id", classId!)
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateDemoSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      sessionDate: string;
      startTime: string;
      endTime: string;
      maxParticipants: number;
      fee: number;
      notes?: string;
    }) => {
      const { error } = await supabase.from("demo_sessions").insert({
        class_id: input.classId,
        session_date: input.sessionDate,
        start_time: input.startTime,
        end_time: input.endTime,
        max_participants: input.maxParticipants,
        fee: input.fee,
        notes: input.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demo-sessions"] });
    },
  });
}

export function useCancelDemoSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("demo_sessions")
        .update({ status: "cancelled" })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demo-sessions"] });
    },
  });
}

// ---- Seeker: browse & book demo sessions ----

export function useUpcomingDemoSessions(classId: string | undefined) {
  return useQuery({
    queryKey: ["upcoming-demos", classId],
    enabled: !!classId,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("demo_sessions")
        .select("id, class_id, session_date, start_time, end_time, max_participants, current_count, fee, status, notes")
        .eq("class_id", classId!)
        .eq("status", "upcoming")
        .gte("session_date", today)
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useMyDemoRegistrations(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-demo-registrations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_registrations")
        .select(`
          id, status, created_at,
          demo_sessions(id, session_date, start_time, end_time, fee, status,
            classes(id, title, cover_image_url)
          ),
          family_members(id, name, relationship)
        `)
        .eq("registered_by", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useBookDemoSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      demoSessionId: string;
      familyMemberId: string;
      registeredBy: string;
    }) => {
      // Register
      const { error: regErr } = await supabase.from("demo_registrations").insert({
        demo_session_id: input.demoSessionId,
        family_member_id: input.familyMemberId,
        registered_by: input.registeredBy,
      });
      if (regErr) throw regErr;

      // Increment count
      const { error: updateErr } = await supabase.rpc("increment_demo_count" as any, {
        session_id: input.demoSessionId,
      });
      // If RPC doesn't exist, do manual increment
      if (updateErr) {
        const { data: sess } = await supabase
          .from("demo_sessions")
          .select("current_count")
          .eq("id", input.demoSessionId)
          .single();
        await supabase
          .from("demo_sessions")
          .update({ current_count: (sess?.current_count ?? 0) + 1 })
          .eq("id", input.demoSessionId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demo-sessions"] });
      qc.invalidateQueries({ queryKey: ["upcoming-demos"] });
      qc.invalidateQueries({ queryKey: ["my-demo-registrations"] });
    },
  });
}

export function useCancelDemoRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from("demo_registrations")
        .update({ status: "cancelled" })
        .eq("id", registrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-demo-registrations"] });
      qc.invalidateQueries({ queryKey: ["demo-sessions"] });
    },
  });
}
