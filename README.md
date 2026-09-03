# AlphaDiagnostic

Plateforme de diagnostic pédagogique d'AlphaDucation, conçue d'abord pour les élèves francophones. La première version évalue deux dimensions :

- les acquis mathématiques d'un élève entrant en EB7 ;
- ses méthodes de travail, sa planification, sa confiance et sa réaction face aux évaluations.

À la fin du parcours, l'élève reçoit un bilan synthétique et des priorités de travail. Les réponses et les coordonnées parentales sont conservées dans des tables Supabase privées.

## Fonctionnalités

- parcours étudiant responsive et accessible, entièrement en français ;
- 12 questions de mathématiques avec niveau de confiance ;
- 24 affirmations sur les méthodes d'apprentissage ;
- 6 mises en situation et un exercice de planification sur trois jours ;
- calcul sécurisé du profil et stockage des tentatives dans Supabase ;
- validation des données côté serveur avec Zod ;
- aucune clé Supabase ni règle de notation exposée dans le navigateur.

## Technologies

- Next.js 16, React 19 et TypeScript ;
- Vinext et Cloudflare Workers ;
- Supabase Postgres, RLS et fonction RPC sécurisée ;
- Tailwind CSS.

## Démarrage local

Prérequis : Node.js `>=22.13.0`.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Renseigner dans `.env.local` les deux variables indiquées dans `.env.example`. La clé `SUPABASE_PUBLISHABLE_KEY` est la clé publique/publishable du projet, jamais la clé `service_role`.

## Vérification

```bash
npm run lint
npm test
```

`npm test` exécute également la compilation de production.

## Déploiement

Le projet est prêt à être déployé depuis ce dépôt sur un hébergeur compatible Cloudflare Workers/Vinext. Dans les paramètres de l'hébergeur, ajouter :

- `SUPABASE_URL` ;
- `SUPABASE_PUBLISHABLE_KEY`.

Ne jamais enregistrer ces valeurs directement dans GitHub. Le projet Supabase doit déjà contenir les migrations et la fonction `submit_diagnostic` décrites dans [supabase/README.md](supabase/README.md).

## Protection des données

Le diagnostic collecte des informations sur des mineurs. La confirmation du parent et son accord sont obligatoires avant le début. Les résultats sont pédagogiques et ne constituent ni un diagnostic médical ni un bilan psychologique. Avant une ouverture publique, AlphaDucation doit valider sa politique de confidentialité, sa durée de conservation et son processus de suppression des données.
