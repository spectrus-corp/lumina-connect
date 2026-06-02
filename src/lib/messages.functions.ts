import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Delete a single message
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      messageId: z.string().uuid(),
      sessionId: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get message details
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .select("id, content, sender_id, channel_id")
      .eq("id", data.messageId)
      .maybeSingle();

    if (msgError || !message) {
      throw new Error("Message not found");
    }

    // Verify user is in session and can delete
    const { data: member, error: memberError } = await supabase
      .from("session_members")
      .select("role")
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !member) {
      throw new Error("Not a member of this session");
    }

    // Only sender or owner can delete
    if (message.sender_id !== userId && member.role !== "owner") {
      throw new Error("You can only delete your own messages");
    }

    // Record deletion
    await supabase
      .from("deleted_messages")
      .insert({
        message_id: data.messageId,
        channel_id: message.channel_id,
        session_id: data.sessionId,
        sender_id: message.sender_id,
        deleted_by_id: userId,
        original_content: message.content,
      });

    // Delete message
    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .eq("id", data.messageId);

    if (deleteError) throw new Error(deleteError.message);

    return { success: true };
  });

// Delete all messages in a channel (conversation)
export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      channelId: z.string().uuid(),
      sessionId: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify user is session owner
    const { data: member, error: memberError } = await supabase
      .from("session_members")
      .select("role")
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !member || member.role !== "owner") {
      throw new Error("Only session owner can delete conversations");
    }

    // Get all messages in channel
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("id, content, sender_id")
      .eq("channel_id", data.channelId);

    if (msgError) throw new Error(msgError.message);

    // Record all deletions
    if (messages && messages.length > 0) {
      const deletedRecords = messages.map((msg) => ({
        message_id: msg.id,
        channel_id: data.channelId,
        session_id: data.sessionId,
        sender_id: msg.sender_id,
        deleted_by_id: userId,
        original_content: msg.content,
      }));

      await supabase
        .from("deleted_messages")
        .insert(deletedRecords);
    }

    // Delete all messages
    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .eq("channel_id", data.channelId);

    if (deleteError) throw new Error(deleteError.message);

    return { success: true, deletedCount: messages?.length ?? 0 };
  });

// Delete session (all messages and data)
export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sessionId: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify user is session owner
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("owner_id")
      .eq("id", data.sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      throw new Error("Session not found");
    }

    if (session.owner_id !== userId) {
      throw new Error("Only session owner can delete session");
    }

    // Get all messages in session to record deletion
    const { data: channels, error: channelError } = await supabase
      .from("channels")
      .select("id")
      .eq("session_id", data.sessionId);

    if (!channelError && channels && channels.length > 0) {
      const channelIds = channels.map((c) => c.id);
      const { data: messages } = await supabase
        .from("messages")
        .select("id, content, sender_id, channel_id")
        .in("channel_id", channelIds);

      if (messages && messages.length > 0) {
        const deletedRecords = messages.map((msg) => ({
          message_id: msg.id,
          channel_id: msg.channel_id,
          session_id: data.sessionId,
          sender_id: msg.sender_id,
          deleted_by_id: userId,
          original_content: msg.content,
        }));

        await supabase
          .from("deleted_messages")
          .insert(deletedRecords);
      }
    }

    // Delete session (cascade will handle related data)
    const { error: deleteError } = await supabase
      .from("sessions")
      .delete()
      .eq("id", data.sessionId);

    if (deleteError) throw new Error(deleteError.message);

    return { success: true };
  });

// Clear my own messages from a channel
export const clearMyMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      channelId: z.string().uuid(),
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

    // Get my messages in channel
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("id, content")
      .eq("channel_id", data.channelId)
      .eq("sender_id", userId);

    if (msgError) throw new Error(msgError.message);

    // Record deletions
    if (messages && messages.length > 0) {
      const deletedRecords = messages.map((msg) => ({
        message_id: msg.id,
        channel_id: data.channelId,
        session_id: data.sessionId,
        sender_id: userId,
        deleted_by_id: userId,
        original_content: msg.content,
      }));

      await supabase
        .from("deleted_messages")
        .insert(deletedRecords);
    }

    // Delete my messages
    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .eq("channel_id", data.channelId)
      .eq("sender_id", userId);

    if (deleteError) throw new Error(deleteError.message);

    return { success: true, deletedCount: messages?.length ?? 0 };
  });
