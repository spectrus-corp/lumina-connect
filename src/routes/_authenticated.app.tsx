import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createSession, joinSessionByCode } from "@/lib/sessions.functions";
import { Plus, KeySquare, LogOut, Settings, ShieldAlert } from "lucide-react";
import { normalizeCode } from "@/lib/session-code";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Mes sessions — Lumina" }] }),
  component: AppHome,
});

type SessionRow = { id: string; code: string; name: string; type: string; ttl_expires_at: string | null };

function AppHome() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profile, setProfile] = useState<{ display_name: string; restricted_mode: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: p }, { data: members }] = await Promise.all([
      supabase.from("profiles").select("display_name, restricted_mode").eq("id", user.id).maybeSingle(),
      supabase.from("session_members").select("session_id").eq("user_id", user.id),
    ]);
    setProfile(p);
    const ids = (members ?? []).map((m) => m.session_id);
    if (ids.length === 0) {
      setSessions([]);
    } else {
      const { data: s } = await supabase
        .from("sessions")
        .select("id, code, name, type, ttl_expires_at")
        .in("id", ids)
        .order("created_at", { ascending: false });
      setSessions(s ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/app" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-foreground" />
          <span className="font-serif text-xl">Lumina</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link to="/settings" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Paramètres">
            <Settings className="h-4 w-4" />
          </Link>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <div>
          <p className="text-sm text-muted-foreground">Bonjour {profile?.display_name ?? "…"}</p>
          <h1 className="mt-1 font-serif text-4xl">Vos sessions</h1>
          {profile?.restricted_mode && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-accent" />
              <div>
                <p className="font-medium text-foreground">Mode restreint actif</p>
                <p className="text-muted-foreground">Pour les 13–15 ans : appels vocaux et partage de fichiers désactivés.</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <CreateSessionCard onCreated={load} />
          <JoinSessionCard onJoined={load} />
        </div>

        <div className="mt-10">
          <h2 className="mb-3 font-serif text-2xl">À l'affiche</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Aucune session pour l'instant. Créez-en une ou collez un code reçu.
            </div>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/sessions/$code"
                    params={{ code: s.code }}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-paper hover:bg-secondary"
                  >
                    <div>
                      <p className="font-serif text-lg leading-tight">{s.name}</p>
                      <p className="code-pill text-xs text-muted-foreground">{s.code}</p>
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {s.type === "temporary" ? "Temporaire" : "Persistante"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function CreateSessionCard({ onCreated }: { onCreated: () => void }) {
  const fn = useServerFn(createSession);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState<"persistent" | "temporary">("persistent");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { session } = await fn({ data: { name: name.trim(), type, ttlHours: type === "temporary" ? 24 : undefined } });
      onCreated();
      navigate({ to: "/sessions/$code", params: { code: session.code } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-paper">
      <div className="flex items-center gap-2 text-foreground">
        <Plus className="h-4 w-4" />
        <span className="font-serif text-xl">Créer une session</span>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom (ex : Famille, Projet Aurore)"
        required
        maxLength={80}
        className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground"
      />
      <div className="mt-2 flex gap-2 text-xs">
        {(["persistent", "temporary"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 rounded-lg border px-3 py-2 ${type === t ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground"}`}
          >
            {t === "persistent" ? "Persistante" : "Temporaire · 24h"}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="mt-3 w-full rounded-xl bg-foreground px-4 py-2.5 text-sm text-background disabled:opacity-50"
      >
        Créer
      </button>
    </form>
  );
}

function JoinSessionCard({ onJoined }: { onJoined: () => void }) {
  const fn = useServerFn(joinSessionByCode);
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const normalized = normalizeCode(code);
      const { code: joinedCode } = await fn({ data: { code: normalized } });
      onJoined();
      navigate({ to: "/sessions/$code", params: { code: joinedCode } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-paper">
      <div className="flex items-center gap-2 text-foreground">
        <KeySquare className="h-4 w-4" />
        <span className="font-serif text-xl">Rejoindre via code</span>
      </div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="LUM-XXXX-XXXX"
        className="code-pill mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-center text-sm tracking-widest outline-none focus:border-foreground"
      />
      <button
        type="submit"
        disabled={busy || code.length < 8}
        className="mt-3 w-full rounded-xl border border-foreground bg-background px-4 py-2.5 text-sm text-foreground disabled:opacity-50"
      >
        Rejoindre
      </button>
    </form>
  );
}