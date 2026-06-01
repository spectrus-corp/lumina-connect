import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Politique de confidentialité — Lumina Session" }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-foreground" />
          <span className="font-serif text-xl">Lumina Session</span>
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-6 pb-24">
        <h1 className="font-serif text-4xl">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-muted-foreground">Version v1 · Hébergement Union européenne · Conforme RGPD</p>

        <Section title="Notre principe : Privacy by Design">
          Lumina Session est conçu pour collecter le strict minimum. Aucune publicité, aucun tracking tiers, aucune vente de données. Aucune fonction de découverte d'inconnus.
        </Section>
        <Section title="Données collectées">
          <ul className="list-disc space-y-1 pl-5">
            <li>Adresse e-mail (pour l'authentification).</li>
            <li>Nom affiché (vous le choisissez).</li>
            <li>Date de naissance (pour activer automatiquement le mode restreint des 13–15 ans).</li>
            <li>Contenu des messages que vous envoyez dans vos sessions.</li>
            <li>Journal d'accès (audit trail) de vos propres actions.</li>
          </ul>
        </Section>
        <Section title="Vos droits">
          À tout moment, depuis l'écran <Link to="/settings" className="underline">Paramètres</Link>, vous pouvez :
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Exporter</strong> l'intégralité de vos données au format JSON.</li>
            <li><strong>Supprimer votre compte</strong> et toutes vos données (droit à l'oubli, action irréversible).</li>
            <li><strong>Consulter votre journal d'accès</strong> personnel.</li>
            <li><strong>Révoquer vos consentements</strong>.</li>
          </ul>
        </Section>
        <Section title="Mineurs (13–15 ans)">
          Le mode restreint s'active automatiquement : désactivation des appels vocaux et du partage de fichiers, restrictions renforcées sur les sessions temporaires.
        </Section>
        <Section title="Sécurité">
          TLS de bout en bout pour le transport. Règles de sécurité au niveau des lignes (RLS) : seuls les membres d'une session voient son contenu. Mots de passe vérifiés contre les fuites connues (HIBP).
        </Section>
        <Section title="Contact">
          Pour toute demande RGPD, écrivez à votre administrateur de session ou utilisez les outils disponibles dans Paramètres.
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}