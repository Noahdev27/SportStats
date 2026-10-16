# SportStats API

API REST dédiée à la centralisation, à l'organisation et à l'analyse de données sportives
(buts, corners, statistiques de matchs), conçue pour être consommée par des algorithmes d'analyse.

- **Runtime** : Node.js (≥ 20.19) + Express 5
- **Langage** : TypeScript (mode `strict`, ESM)
- **ORM / BDD** : Prisma ORM 7 (adaptateur `@prisma/adapter-pg`) + PostgreSQL
- **Validation & sécurité** : Zod 4, Helmet, CORS, middleware global de gestion d'erreurs
- **IA** : Grok (xAI) pour l'analyse d'avant-match, les résumés d'équipe et les questions en langage naturel
- **Documentation** : OpenAPI 3.0 + Swagger UI (`/api-docs`)
- **Tests** : Vitest + Supertest (tests d'intégration sur une vraie base PostgreSQL)

## Démarrage rapide

```bash
# 1. Dépendances (génère aussi le client Prisma)
npm install

# 2. Configuration
cp .env.example .env

# 3. PostgreSQL (ou utilisez votre propre instance et adaptez DATABASE_URL)
docker compose up -d

# 4. Schéma + données de démonstration
npm run db:deploy
npm run db:seed

# 5. Lancement en mode développement (rechargement à chaud)
npm run dev
```

- API : http://localhost:3000/api/v1
- Swagger UI : http://localhost:3000/api-docs
- Spécification brute : http://localhost:3000/api-docs.json
- Santé : http://localhost:3000/health

## Scripts

| Script | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement (`tsx watch`) |
| `npm run build` / `npm start` | Compilation TypeScript vers `dist/` puis exécution |
| `npm run typecheck` | Vérification des types (sources, seed, tests) |
| `npm test` | Tests d'intégration (base `sportstats_test`) |
| `npm run db:migrate` | Crée/applique une migration en développement |
| `npm run db:deploy` | Applique les migrations existantes |
| `npm run db:seed` | Vide les tables puis insère les données de démonstration |
| `npm run db:studio` | Prisma Studio |

## Architecture

Respect strict d'une architecture en couches : **Routes → Controllers → Services → ORM**.

```
prisma/
├── schema.prisma      # Modèle de données (Team, Match, MatchStatistics)
├── migrations/        # Migrations SQL (dont contraintes CHECK d'intégrité)
└── seed.ts            # Données réalistes et reproductibles
src/
├── config/            # Env (validé par Zod), client Prisma, spécification OpenAPI
├── controllers/       # Couche HTTP : lit la requête validée, renvoie la réponse
├── services/          # Logique métier & requêtes Prisma / SQL d'agrégation
│   └── ai/            # Client Grok (xAI) et modèles de prompts
├── routes/            # Endpoints Express + middlewares de validation
├── middlewares/       # Validation Zod, gestion d'erreurs, logger de requêtes
├── types/             # Schémas Zod (DTO) et types dérivés
├── utils/             # AppError, pagination, logger
├── app.ts             # Construction de l'application Express
└── server.ts          # Démarrage HTTP + arrêt propre (SIGINT/SIGTERM)
tests/                 # Tests d'intégration (API, analytics, couverture OpenAPI)
```

- Les **routes** déclarent l'endpoint et les schémas Zod à appliquer (`params`, `query`, `body`).
- Le middleware **`validate`** remplace les données brutes par les données parsées
  (types convertis, valeurs par défaut) et renvoie toutes les erreurs en une seule réponse.
- Les **controllers** ne contiennent aucune logique métier ; les **services** lèvent des
  `AppError` (404, 409...) traduites en JSON par le **gestionnaire d'erreurs global**
  (qui gère aussi les erreurs Prisma, le JSON malformé et les erreurs inattendues).

## Endpoints

Tous les endpoints métier sont préfixés par `/api/v1`.

| Méthode | Endpoint | Description |
| --- | --- | --- |
| GET | `/teams` | Liste paginée — `search`, `country`, `sortBy`, `order`, `page`, `limit` |
| POST | `/teams` | Créer une équipe |
| GET | `/teams/:id` | Détail d'une équipe |
| PATCH | `/teams/:id` | Modification partielle |
| DELETE | `/teams/:id` | Suppression (refusée si l'équipe a des matchs) |
| GET | `/matches` | Liste paginée avec filtres avancés (voir ci-dessous) |
| POST | `/matches` | Créer un match (statistiques optionnelles imbriquées) |
| GET | `/matches/:id` | Détail (équipes + statistiques) |
| PATCH | `/matches/:id` | Modification partielle (règles métier vérifiées sur l'état final) |
| DELETE | `/matches/:id` | Suppression (statistiques supprimées en cascade) |
| GET | `/matches/:id/statistics` | Statistiques d'un match |
| PUT | `/matches/:id/statistics` | Créer (201) ou remplacer (200) les statistiques |
| DELETE | `/matches/:id/statistics` | Supprimer les statistiques |
| GET | `/stats/overview` | Agrégats globaux : moyennes buts/corners, +2.5, BTTS, 1N2 |
| GET | `/stats/standings` | Classement avec statistiques globales / domicile / extérieur |
| GET | `/stats/teams/:id` | Statistiques d'une équipe : global / domicile / extérieur |
| GET | `/ai/matches/:id/preview` | Analyse d'avant-match rédigée par Grok |
| GET | `/ai/teams/:id/summary` | Résumé des performances d'une équipe rédigé par Grok |
| POST | `/ai/ask` | Question en langage naturel sur les données |

### Filtres des matchs (`GET /api/v1/matches`)

| Paramètre | Exemple | Effet |
| --- | --- | --- |
| `teamId` | `1` | Matchs de l'équipe, à domicile **ou** à l'extérieur |
| `homeTeamId` / `awayTeamId` | `2` | Équipe à domicile / à l'extérieur |
| `status` | `FINISHED,LIVE` | Un ou plusieurs statuts (`SCHEDULED`, `LIVE`, `FINISHED`, `POSTPONED`, `CANCELLED`) |
| `date` | `2026-10-09` | Matchs d'une journée précise (UTC) |
| `from` / `to` | `2026-08-01` / `2026-08-31` | Intervalle ; `to` au format `YYYY-MM-DD` inclut toute la journée |
| `competition`, `season`, `matchday` | `Ligue 1`, `2026/2027`, `5` | Compétition, saison, journée |
| `order`, `page`, `limit` | `asc`, `2`, `50` | Tri par date de coup d'envoi, pagination (`limit` ≤ 100) |

```bash
curl "http://localhost:3000/api/v1/matches?teamId=1&status=FINISHED&from=2026-08-01&order=asc"
```

### Analytics

Les agrégations sont calculées **en SQL** (une seule requête par endpoint) et ne portent que
sur les matchs `FINISHED` avec un score. Filtres communs : `competition`, `season`, `from`, `to`.

`GET /api/v1/stats/overview?season=2025/2026` (filtre supplémentaire : `teamId`)

```json
{
  "data": {
    "filters": { "season": "2025/2026" },
    "matches": 90,
    "goals": { "home": 1.54, "away": 1.09, "total": 2.63, "over15Rate": 0.7556, "over25Rate": 0.5667, "bttsRate": 0.5667 },
    "corners": { "matchesWithData": 90, "home": 4.9, "away": 4.59, "total": 9.49, "over95Rate": 0.4667 },
    "results": { "homeWinRate": 0.4667, "drawRate": 0.3222, "awayWinRate": 0.2111 }
  }
}
```

`GET /api/v1/stats/teams/1?last=5` (filtre supplémentaire : `last` = N derniers matchs) renvoie
`overall`, `home` et `away`, chacun avec : bilan V/N/D et points, buts pour/contre (totaux et
moyennes), taux +2.5 buts, BTTS, clean sheets, et moyennes de corners obtenus/concédés.

Conventions :

- moyennes arrondies à 2 décimales, taux exprimés en **ratio entre 0 et 1** (4 décimales) ;
- `null` lorsqu'aucun match ne correspond (pas de division par zéro) ;
- les corners ne sont moyennés que sur les matchs disposant de statistiques (`matchesWithData`).

`GET /api/v1/stats/standings?season=2026/2027` renvoie le classement (points, puis différence de
buts, puis buts marqués), chaque ligne contenant les mêmes blocs `overall` / `home` / `away`.

## IA (Grok)

L'API utilise **Grok** (xAI) via son endpoint compatible OpenAI (`POST {XAI_BASE_URL}/chat/completions`),
avec le `fetch` natif de Node : aucun SDK supplémentaire.

**Principe** : l'API calcule elle-même les statistiques (SQL), puis les transmet à Grok en JSON avec
la consigne de s'appuyer **uniquement** sur ces données, sans rien inventer (blessures, transferts...).
Chaque réponse contient le texte rédigé (`analysis`, en Markdown) **et** les données envoyées
(`context`), ce qui permet de vérifier l'analyse ou d'exploiter directement les chiffres.

| Endpoint | Données transmises à Grok |
| --- | --- |
| `GET /api/v1/ai/matches/:id/preview` | Forme (5 derniers matchs), stats domicile de l'équipe recevante et extérieur de l'équipe visiteuse sur la saison, 5 dernières confrontations directes, moyennes du championnat — uniquement des matchs antérieurs au coup d'envoi. Matchs `SCHEDULED`, `POSTPONED` ou `LIVE`. |
| `GET /api/v1/ai/teams/:id/summary` | Stats de l'équipe (mêmes filtres que `/stats/teams/:id`) + 5 derniers résultats |
| `POST /api/v1/ai/ask` | Classement complet avec splits domicile/extérieur, moyennes du championnat, 15 derniers résultats, 10 prochains matchs. Saison par défaut : la plus récente. |

```bash
curl -X POST http://localhost:3000/api/v1/ai/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Quelle équipe obtient le plus de corners à domicile ?"}'
```

**Configuration** :

1. Créez une clé API sur [console.x.ai](https://console.x.ai) et renseignez `XAI_API_KEY` dans `.env`.
2. Vérifiez dans la console le modèle disponible pour votre compte et ajustez `XAI_MODEL`
   (par défaut `grok-3-mini`, l'un des moins chers). Les crédits gratuits proposés par xAI
   varient selon les périodes : consultez votre tableau de bord.
3. `AI_RATE_LIMIT_PER_MINUTE` (10 par défaut) limite les appels par minute et par IP pour
   préserver vos crédits.

Sans clé, le reste de l'API fonctionne normalement et les endpoints `/ai` répondent
`503 AI_NOT_CONFIGURED`. Les probabilités produites par Grok sont des estimations indicatives
fondées sur les statistiques, pas des prédictions fiables.

## Formats de réponse

```jsonc
// Ressource unique
{ "data": { "id": 1, "...": "..." } }

// Liste paginée
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 180, "totalPages": 9 } }

// Erreur
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les données envoyées sont invalides.",
    "details": [{ "path": "body.awayTeamId", "message": "L'équipe à l'extérieur doit être différente de l'équipe à domicile." }]
  }
}
```

| Statut | Codes d'erreur |
| --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `BAD_REQUEST` |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 409 | `TEAM_ALREADY_EXISTS`, `TEAM_HAS_MATCHES`, `MATCH_NOT_PLAYED`, `UNIQUE_CONSTRAINT`, `FOREIGN_KEY_CONSTRAINT` |
| 409 (IA) | `MATCH_NOT_UPCOMING` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 429 | `RATE_LIMITED` (limite de l'API), `AI_RATE_LIMITED` (quota Grok) |
| 500 | `INTERNAL_SERVER_ERROR`, `DATABASE_ERROR` |
| 502 / 503 / 504 | `AI_UPSTREAM_ERROR`, `AI_AUTH_ERROR` / `AI_NOT_CONFIGURED` / `AI_TIMEOUT` |

## Règles métier des matchs

- `homeTeamId` ≠ `awayTeamId` et les deux équipes doivent exister.
- Un match `FINISHED` a obligatoirement un score ; un match `SCHEDULED`, `POSTPONED` ou
  `CANCELLED` n'a ni score ni statistiques.
- Les scores (et scores à la mi-temps) vont par paire ; la mi-temps ne dépasse pas le score final.
- Statistiques : possession domicile + extérieur = 100, tirs cadrés ≤ tirs.
- Les `PATCH` sont validés sur l'état résultant (match existant + modifications).
- Des contraintes `CHECK` PostgreSQL doublent les règles critiques (équipes distinctes,
  valeurs positives, possession entre 0 et 100).

## Données de démonstration

`npm run db:seed` **vide les tables** puis génère un championnat de 10 clubs de Ligue 1 sur deux
saisons (aller-retour, une journée toutes les deux semaines) :

- `2025/2026` : 90 matchs terminés ;
- `2026/2027` : matchs passés terminés (dont un reporté), matchs futurs programmés.

Les résultats sont **simulés** (ce ne sont pas des résultats réels) par un modèle de Poisson
tenant compte de la force offensive/défensive de chaque club et de l'avantage du terrain, ce qui
donne des distributions réalistes (≈ 2,6 buts et ≈ 9,5 corners par match, avantage domicile...).
Le générateur aléatoire est initialisé avec une graine fixe : les données sont reproductibles.

## Tests

```bash
npm test
```

Les tests d'intégration utilisent la base désignée par `TEST_DATABASE_URL` (par défaut
`postgresql://sportstats:sportstats@localhost:5432/sportstats_test`, créée automatiquement par
`docker compose`). Les migrations y sont appliquées au démarrage et les tables vidées entre les
tests ; par sécurité, la suite refuse de s'exécuter sur une base dont le nom ne contient pas `test`.

Ils couvrent le CRUD, la validation et les règles métier, les filtres, les calculs d'analytics
(valeurs vérifiées à la main), les endpoints IA (Grok est simulé : aucun appel réel, aucun crédit
consommé) et la **couverture de la documentation** : un test échoue si une
route Express n'est pas décrite dans la spécification OpenAPI (ou inversement).

## Variables d'environnement

| Variable | Défaut | Description |
| --- | --- | --- |
| `DATABASE_URL` | — (requis) | Chaîne de connexion PostgreSQL |
| `PORT` | `3000` | Port HTTP |
| `NODE_ENV` | `development` | `development`, `production` ou `test` |
| `CORS_ORIGIN` | `*` | Origines autorisées, séparées par des virgules |
| `XAI_API_KEY` | — (optionnel) | Clé API Grok ; sans elle, `/ai` répond 503 |
| `XAI_MODEL` | `grok-3-mini` | Modèle Grok utilisé |
| `XAI_BASE_URL` | `https://api.x.ai/v1` | URL de l'API xAI |
| `XAI_TIMEOUT_MS` | `60000` | Délai maximal d'une réponse Grok |
| `AI_RATE_LIMIT_PER_MINUTE` | `10` | Appels IA autorisés par minute et par IP |
| `TEST_DATABASE_URL` | base `sportstats_test` locale | Base utilisée par `npm test` |
