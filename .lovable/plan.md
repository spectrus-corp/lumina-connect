# Lumina Session — Plan V1

Messagerie privée par sessions à code, conforme RGPD, installable (PWA), backend EU via Lovable Cloud.

## Stack
- TanStack Start + React + TypeScript + Tailwind v4 (stack disponible ; Next.js non supporté ici, équivalent fonctionnel)
- Lovable Cloud (Supabase EU) : Auth email + Google, Postgres avec RLS, Realtime, Storage
- Service Worker + Web App Manifest pour PWA et notifications push

## Design system (Papier & Encre)
- Palette : `#f5f3ee` fond, `#e8e4dd` surface, `#2d2d2d` encre, `#0d0d0d` titre, accent encre nuit
- Typo : Instrument Serif (titres) + Inter (corps), inspiration Notion + Apple Messages
- Coins doux (radius 14), ombres papier subtiles, micro-animations discrètes
- Mode sombre miroir (encre inversée)
- Tokens dans `src/styles.css` (oklch), variantes Button/Card dédiées

## Écrans V1
1. **Accueil** : pitch, "Créer une session" / "Rejoindre via code", manifeste de confidentialité
2. **Auth** : email/mot de passe + Google (broker Lovable), case consentement RGPD explicite + date de naissance (→ mode restreint 13-15 ans)
3. **Créer une session** : nom, type (persistante/temporaire avec TTL), → code `LUM-XXXX-XXXX` + QR + lien court copiable
4. **Rejoindre** : champ code (auto-format), scan QR (lien direct)
5. **Session** : sidebar canaux, fil de chat temps réel, réactions, statut typing, membres, paramètres session
6. **Paramètres & Confidentialité** : politique intégrée, export données (JSON), suppression compte (droit à l'oubli), gestion consentements, journal d'accès
7. **Mode restreint** : badge visible, fonctions sensibles désactivées pour 13-15 ans

## Backend (Lovable Cloud, région EU)
Tables avec RLS strict :
- `profiles` (id, display_name, birthdate, restricted_mode, consent_version, consent_at)
- `sessions` (id, code unique, name, type, ttl_expires_at, owner_id)
- `session_members` (session_id, user_id, role, joined_at)
- `channels` (id, session_id, name)
- `messages` (id, channel_id, sender_id, content, created_at, expires_at)
- `audit_log` (user_id, action, target, created_at) — journalisation accès
- `consents` (user_id, type, version, granted_at, revoked_at)

Server functions :
- `createSession`, `joinByCode`, `leaveSession`
- `exportMyData` (zip JSON), `deleteMyAccount` (cascade complète)
- `logAccess` (middleware)

## RGPD (Privacy by Design)
- Minimisation : aucun champ optionnel inutile, pas d'analytics tiers, pas de tracking
- Consentement explicite versionné, révocable, traçable
- Chiffrement transport (TLS Cloud) + colonnes sensibles chiffrées côté client (WebCrypto AES-GCM) pour contenu messages — clé dérivée du code de session (zero-knowledge serveur sur le contenu)
- Droit à l'oubli : bouton "Supprimer mon compte" → purge profils, messages, médias, sessions orphelines
- Export : téléchargement JSON de toutes les données utilisateur
- Mode 13-15 ans détecté à l'inscription : restrictions automatiques, message d'info parents
- Politique de confidentialité intégrée à l'app (`/privacy`)
- Bannière consentement au 1er login (non bloquante après)

## PWA & Push
- `public/manifest.webmanifest` + icônes
- `public/sw.js` — service worker auto-install, push handler, notifications riches avec actions
- Hook `usePushSubscription` → enregistre subscription dans table `push_subscriptions`
- Server fn `sendPush` (VAPID) déclenchée sur nouveau message / mention / join
- ⚠️ Le SW est désactivé dans la preview iframe Lovable (cf. règles plateforme) ; il s'active en production publiée

## Hors scope V1 (itérations suivantes)
- Salons vocaux temps réel (WebRTC SFU) — nécessite infra dédiée
- Messages vocaux + transcription Whisper
- IA Echo (reformulation/traduction) — facile à ajouter via Lovable AI Gateway après V1
- Partage fichiers avec expiration — V1 fera texte+réactions, fichiers en itération 2

## Livraison
Tout en une passe : design system, schéma DB + RLS + migrations, auth, écrans 1→7, RGPD, manifest + SW + push scaffold. Tu pourras ensuite itérer module par module (vocal, IA Echo, fichiers).
