import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Start a call (video or audio)
export const startCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sessionId: z.string().uuid(),
      callType: z.enum(["audio", "video"]),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify user is in session
    const { data: member, error: memberError } = await supabase
      .from("session_members")
      .select("role")
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !member) {
      throw new Error("Not a member of this session");
    }

    // Create call
    const { data: call, error } = await supabase
      .from("calls")
      .insert({
        session_id: data.sessionId,
        initiator_id: userId,
        call_type: data.callType,
        status: "active",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Add initiator as participant
    await supabase
      .from("call_participants")
      .insert({
        call_id: call.id,
        user_id: userId,
      });

    return call;
  });

// End a call
export const endCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      callId: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify user is initiator
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("initiator_id")
      .eq("id", data.callId)
      .maybeSingle();

    if (callError || !call) {
      throw new Error("Call not found");
    }

    if (call.initiator_id !== userId) {
      throw new Error("Only initiator can end call");
    }

    // Update call status
    const { error } = await supabase
      .from("calls")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", data.callId);

    if (error) throw new Error(error.message);

    return { success: true };
  });

// Join a call
export const joinCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      callId: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify call exists and is active
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("session_id, status")
      .eq("id", data.callId)
      .maybeSingle();

    if (callError || !call) {
      throw new Error("Call not found");
    }

    if (call.status !== "active") {
      throw new Error("Call is no longer active");
    }

    // Verify user is in session
    const { data: member, error: memberError } = await supabase
      .from("session_members")
      .select("role")
      .eq("session_id", call.session_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !member) {
      throw new Error("Not a member of this session");
    }

    // Add as participant
    const { error: insertError } = await supabase
      .from("call_participants")
      .insert({
        call_id: data.callId,
        user_id: userId,
      });

    if (insertError && !insertError.message.includes("duplicate")) {
      throw new Error(insertError.message);
    }

    return { success: true };
  });

// Leave a call
export const leaveCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      callId: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Update participant left_at
    const { error } = await supabase
      .from("call_participants")
      .update({
        left_at: new Date().toISOString(),
      })
      .eq("call_id", data.callId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    return { success: true };
  });

// Get active calls in session
export const getActiveCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sessionId: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify user is in session
    const { data: member } = await supabase
      .from("session_members")
      .select("role")
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member) {
      throw new Error("Not a member of this session");
    }

    // Get active calls
    const { data: calls, error } = await supabase
      .from("calls")
      .select(`
        id,
        call_type,
        initiator_id,
        started_at,
        call_participants(user_id, joined_at, left_at)
      `)
      .eq("session_id", data.sessionId)
      .eq("status", "active")
      .order("started_at", { ascending: false });

    if (error) throw new Error(error.message);

    return calls ?? [];
  });
