import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { exportMyData, deleteMyAccount } from "@/lib/sessions.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Download, Trash2, FileText } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Paramètres — Lumina" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const exportFn = useServerFn(exportMyData);
  const deleteFn = useServerFn(deleteMyAccount);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);

  async function onExport() {
    setBusy("export");
    try {
      const data = await exportFn();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `lumina-export-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setBusy(null); }
  }

  async function onDelete() {
    if (!confirm("Supprimer définitivement votre compte et toutes vos données ? Cette action est irréversible.")) return;
    setBusy("delete");
    try {
      await deleteFn();
      await supabase.auth.signOut();
      toast.success("Compte supprimé.");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setBusy(null); }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-6">
        <Link to="/app" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-serif text-2xl">Paramètres & confidentialité</h1>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-6 pb-24">
        <Link to="/privacy" className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-paper hover:bg-secondary">
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4" />
            <div>
              <p className="font-serif text-lg">Politique de confidentialité</p>
              <p className="text-xs text-muted-foreground">Lire la version intégrée à l'application.</p>
            </div>
          </div>
        </Link>

        <button
          onClick={onExport}
          disabled={busy !== null}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-5 text-left shadow-paper hover:bg-secondary disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <Download className="h-4 w-4" />
            <div>
              <p className="font-serif text-lg">Exporter mes données</p>
              <p className="text-xs text-muted-foreground">Téléchargez toutes vos données en JSON (RGPD, article 20).</p>
            </div>
          </div>
          <span className="text-xs uppercase text-muted-foreground">{busy === "export" ? "…" : "JSON"}</span>
        </button>

        <button
          onClick={onDelete}
          disabled={busy !== null}
          className="flex w-full items-center justify-between rounded-2xl border border-destructive/30 bg-card p-5 text-left shadow-paper hover:bg-destructive/5 disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <Trash2 className="h-4 w-4 text-destructive" />
            <div>
              <p className="font-serif text-lg text-destructive">Supprimer mon compte</p>
              <p className="text-xs text-muted-foreground">Droit à l'oubli. Action immédiate et irréversible.</p>
            </div>
          </div>
        </button>
      </main>
    </div>
  );
}