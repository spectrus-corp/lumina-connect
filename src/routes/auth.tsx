import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/app",
  }),
  head: () => ({
    meta: [
      { title: "Se connecter — Lumina Session" },
      { name: "description", content: "Connectez-vous ou créez un compte pour ouvrir et rejoindre des sessions privées." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const redirectTo = search.redirect.startsWith("/") ? search.redirect : "/app";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (cancelled) return;
      if (error) {
        await supabase.auth.signOut();
        return;
      }
      if (data.user) navigate({ to: redirectTo as never, replace: true });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        navigate({ to: redirectTo as never, replace: true });
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate, redirectTo]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!consent) {
          toast.error("Vous devez accepter la politique de confidentialité.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: { display_name: displayName, birthdate },
          },
        });
        if (error) throw error;
        toast.success("Compte créé. Vous pouvez maintenant vous connecter.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-foreground" />
          <span className="font-serif text-xl">Lumina Session</span>
        </Link>
      </header>

      <main className="mx-auto max-w-md px-6 pb-16">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-paper">
          <h1 className="font-serif text-3xl">
            {mode === "signin" ? "Bon retour." : "Créer un compte."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Aucune découverte d'inconnu. Vos sessions vous attendent."
              : "Minimum de données. Vous gardez le contrôle."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            {mode === "signup" && (
              <>
                <Field label="Nom affiché" value={displayName} onChange={setDisplayName} required />
                <Field
                  label="Date de naissance"
                  type="date"
                  value={birthdate}
                  onChange={setBirthdate}
                  required
                  hint="Active automatiquement le Mode restreint pour les 13–15 ans."
                />
              </>
            )}
            <Field label="E-mail" type="email" value={email} onChange={setEmail} required />
            <Field
              label="Mot de passe"
              type="password"
              value={password}
              onChange={setPassword}
              required
              hint={mode === "signup" ? "Minimum 8 caractères. Vérifié contre les fuites connues." : undefined}
            />

            {mode === "signup" && (
              <label className="mt-2 flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  J'ai lu et j'accepte la{" "}
                  <Link to="/privacy" className="underline">politique de confidentialité</Link>.
                  Mon consentement est tracé, versionné et révocable à tout moment depuis mes paramètres.
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-3 w-full rounded-xl bg-foreground px-4 py-3 text-background shadow-paper disabled:opacity-50"
            >
              {loading ? "…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Pas encore de compte ? Créer un compte" : "Déjà inscrit ? Se connecter"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required, hint,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-foreground outline-none focus:border-foreground"
      />
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}