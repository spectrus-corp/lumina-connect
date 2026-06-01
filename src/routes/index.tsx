import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock, KeySquare, Sparkles, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumina Session — messagerie privée par code" },
      { name: "description", content: "Une messagerie sans recherche, sans découverte, sans publicité. Tout passe par un code de session." },
      { property: "og:title", content: "Lumina Session" },
      { property: "og:description", content: "Messagerie ultra-privée, conforme RGPD." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-foreground" />
          <span className="font-serif text-xl">Lumina Session</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/privacy" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">Confidentialité</Link>
          <Link to="/auth" className="rounded-md bg-foreground px-3 py-2 text-background hover:opacity-90">Se connecter</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-20 md:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Données hébergées en Europe · Conforme RGPD
          </span>
          <h1 className="mt-6 font-serif text-5xl leading-[1.05] tracking-tight md:text-7xl">
            La messagerie qui<br/>
            <em className="text-muted-foreground">ne se cherche pas.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Pas de profils publics. Pas de découverte. Pas de pub. Tout commence par un code de session unique que vous partagez à qui vous voulez.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-background shadow-paper hover:opacity-90"
            >
              Créer une session
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-foreground hover:bg-secondary"
            >
              Rejoindre avec un code
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-24 md:grid-cols-3">
          {[
            { icon: KeySquare, title: "Accès par code", text: "LUM-9X7K-P2MQ. Un code suffit pour rejoindre. Personne d'autre ne peut entrer." },
            { icon: Lock, title: "Privacy by design", text: "Minimisation, droit à l'oubli, export complet, journal d'accès. Tout est dans l'app." },
            { icon: Sparkles, title: "Echo, l'IA discrète", text: "Reformulation, traduction, détection de ton. Optionnelle, jamais activée par défaut." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-paper">
              <f.icon className="h-5 w-5 text-foreground" />
              <h3 className="mt-4 font-serif text-2xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>

        <footer className="border-t border-border py-8 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} Lumina Session</span>
            <div className="flex gap-4">
              <Link to="/privacy" className="hover:text-foreground">Politique de confidentialité</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
