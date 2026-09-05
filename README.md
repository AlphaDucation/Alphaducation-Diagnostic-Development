# AlphaDiagnostic

Plateforme de diagnostic pédagogique d'AlphaDucation pour les élèves francophones de la Grade 6 à la Terminale suivant le curriculum libanais. Elle évalue deux dimensions :

- les acquis et prérequis mathématiques propres au niveau et à la branche de l'élève ;
- ses méthodes de travail, sa planification, sa confiance et sa réaction face aux évaluations.

À la fin du parcours, l'élève reçoit un bilan synthétique et des priorités de travail. Les réponses et les coordonnées parentales sont conservées dans des tables Supabase privées.

## Fonctionnalités

- parcours étudiant responsive et accessible, entièrement en français ;
- 10 banques indépendantes : G6, G7, G8, G9, S1, S2 et Terminale SG/SV/SE/LH ;
- quatre parcours : début d'année, milieu d'année, fin d'année et positionnement approfondi ;
- déclaration des chapitres étudiés et exclusion explicite des chapitres non enseignés ;
- questions diagnostiques, raisonnement, analyse d'erreur, transfert et confiance ;
- profil de métacognition, autorégulation, stratégies, examen, affect mathématique et usage de l'IA ;
- exercice de planification sur trois jours ;
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

Ne jamais enregistrer ces valeurs directement dans GitHub. Le projet Supabase doit déjà contenir les migrations et les fonctions `submit_diagnostic` et `submit_diagnostic_v2` décrites dans [supabase/README.md](supabase/README.md).

## Protection des données

Le diagnostic collecte des informations sur des mineurs. La confirmation du parent et son accord sont obligatoires avant le début. Les résultats sont pédagogiques et ne constituent ni un diagnostic médical ni un bilan psychologique. Avant une ouverture publique, AlphaDucation doit valider sa politique de confidentialité, sa durée de conservation et son processus de suppression des données.
