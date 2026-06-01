import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateSessionCode, isValidCode } from "./session-code";

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        type: z.enum(["persistent", "temporary"]),
        ttlHours: z.number().int().min(1).max(168).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Generate unique code (retry up to 5x in unlikely collision)
    let code = generateSessionCode();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase
        .from("sessions")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (!existing) break;
      code = generateSessionCode();
    }

    const ttl =
      data.type === "temporary" && data.ttlHours
        ? new Date(Date.now() + data.ttlHours * 3600 * 1000).toISOString()
        : null;

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        name: data.name,
        type: data.type,
        ttl_expires_at: ttl,
        owner_id: userId,
        code,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Add owner as member
    await supabase.from("session_members").insert({
      session_id: session.id,
      user_id: userId,
      role: "owner",
    });

    // Default channel
    await supabase.from("channels").insert({
      session_id: session.id,
      name: "général",
    });

    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "session.create",
      target: session.id,
    });

    return { session };
  });

export const joinSessionByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(11).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = data.code.toUpperCase();
    if (!isValidCode(code)) throw new Error("Code invalide. Format attendu : LUM-XXXX-XXXX");

    // Use admin lookup via RPC-style: fetch via service-role to find session by code
    // We can't read sessions directly (RLS), so use a public function approach:
    const { data: session, error } = await supabase
      .from("sessions")
      .select("id, code, name, ttl_expires_at, owner_id")
      .eq("code", code)
      .maybeSingle();

    // Fallback: if RLS hides it, look it up with admin client
    let target = session;
    if (!target) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: s2 } = await supabaseAdmin
        .from("sessions")
        .select("id, code, name, ttl_expires_at, owner_id")
        .eq("code", code)
        .maybeSingle();
      target = s2 ?? null;
    }
    if (!target) throw new Error("Aucune session trouvée pour ce code.");

    if (target.ttl_expires_at && new Date(target.ttl_expires_at).getTime() < Date.now()) {
      throw new Error("Cette session a expiré.");
    }

    // Insert membership (idempotent)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("session_members")
      .upsert(
        { session_id: target.id, user_id: userId, role: "member" },
        { onConflict: "session_id,user_id", ignoreDuplicates: true },
      );

    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "session.join",
      target: target.id,
    });

    return { sessionId: target.id, code: target.code };
  });

export const leaveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("session_members")
      .delete()
      .eq("session_id", data.sessionId)
      .eq("user_id", userId);
    await supabase.from("audit_log").insert({
      user_id: userId,
      action: "session.leave",
      target: data.sessionId,
    });
    return { ok: true };
  });

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, sessions, members, messages, consents, audit] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("sessions").select("*").eq("owner_id", userId),
      supabase.from("session_members").select("*").eq("user_id", userId),
      supabase.from("messages").select("*").eq("sender_id", userId),
      supabase.from("consents").select("*").eq("user_id", userId),
      supabase.from("audit_log").select("*").eq("user_id", userId),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      profile: profile.data,
      sessions: sessions.data,
      memberships: members.data,
      messages: messages.data,
      consents: consents.data,
      auditLog: audit.data,
    };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cascade via FKs handles related rows
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });