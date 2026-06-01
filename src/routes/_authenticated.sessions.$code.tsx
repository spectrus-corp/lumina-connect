import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { leaveSession } from "@/lib/sessions.functions";
import { ArrowLeft, Copy, Send, LogOut, Hash } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/_authenticated/sessions/$code")({
  head: ({ params }) => ({ meta: [{ title: `${params.code} — Lumina` }] }),
  component: SessionView,
});

type Message = { id: string; content: string; sender_id: string; created_at: string };

function SessionView() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const leaveFn = useServerFn(leaveSession);
  const [session, setSession] = useState<{ id: string; name: string; owner_id: string } | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: s, error } = await supabase
        .from("sessions")
        .select("id, name, owner_id")
        .eq("code", code)
        .maybeSingle();
      if (error || !s) { toast.error("Session introuvable ou accès refusé."); navigate({ to: "/app" }); return; }
      if (cancelled) return;
      setSession(s);
      const { data: chans } = await supabase
        .from("channels").select("id").eq("session_id", s.id).order("created_at").limit(1);
      const cid = chans?.[0]?.id ?? null;
      setChannelId(cid);
      if (cid) {
        const { data: msgs } = await supabase
          .from("messages").select("id, content, sender_id, created_at")
          .eq("channel_id", cid).order("created_at", { ascending: true }).limit(200);
        setMessages(msgs ?? []);
      }
    })();
    return () => { cancelled = true; };
  }, [code, navigate]);

  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [channelId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!channelId || !session || !userId || !draft.trim()) return;
    const content = draft.trim();
    setDraft("");
    const { error } = await supabase.from("messages").insert({
      channel_id: channelId, session_id: session.id, sender_id: userId, content,
    });
    if (error) { toast.error(error.message); setDraft(content); }
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/sessions/${code}` : "";

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/app" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="font-serif text-lg leading-tight">{session?.name ?? "…"}</p>
            <p className="code-pill text-xs text-muted-foreground">{code}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowInvite(true)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
            Inviter
          </button>
          <button
            onClick={async () => {
              if (!session) return;
              await leaveFn({ data: { sessionId: session.id } });
              navigate({ to: "/app" });
            }}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Quitter"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 border-r border-border bg-sidebar p-3 md:block">
          <p className="px-2 text-xs uppercase tracking-wider text-muted-foreground">Canaux</p>
          <button className="mt-2 flex w-full items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
            <Hash className="h-3.5 w-3.5" /> général
          </button>
        </aside>

        <div className="flex flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            {messages.length === 0 ? (
              <p className="mx-auto max-w-md text-center text-sm text-muted-foreground">
                Cette session est vide. Écrivez le premier message.
              </p>
            ) : (
              <ul className="mx-auto max-w-2xl space-y-2">
                {messages.map((m) => {
                  const mine = m.sender_id === userId;
                  return (
                    <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-foreground text-background" : "bg-card text-foreground border border-border"}`}>
                        {m.content}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <form onSubmit={send} className="border-t border-border bg-card px-4 py-3">
            <div className="mx-auto flex max-w-2xl items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écrire un message…"
                maxLength={2000}
                className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-foreground"
              />
              <button type="submit" disabled={!draft.trim()} className="rounded-full bg-foreground p-2.5 text-background disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-paper" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-2xl">Inviter</h2>
            <p className="mt-1 text-sm text-muted-foreground">Partagez ce code ou ce QR. Personne d'autre ne peut entrer.</p>
            <div className="mt-4 flex justify-center rounded-2xl bg-background p-4">
              <QRCodeSVG value={shareUrl} size={180} bgColor="transparent" fgColor="currentColor" />
            </div>
            <p className="code-pill mt-4 text-center text-lg">{code}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(code); toast.success("Code copié"); }}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <Copy className="h-3.5 w-3.5" /> Code
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Lien copié"); }}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <Copy className="h-3.5 w-3.5" /> Lien
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}