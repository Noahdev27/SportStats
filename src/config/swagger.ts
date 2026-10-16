import { env } from './env.js';

/**
 * OpenAPI 3.0 specification served at `/api-docs` (UI) and `/api-docs.json` (raw).
 * `tests/openapi.test.ts` checks that every Express route is documented here.
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const param = (name: string) => ({ $ref: `#/components/parameters/${name}` });
const response = (name: string) => ({ $ref: `#/components/responses/${name}` });
const json = (schema: object, example?: unknown) => ({
  'application/json': { schema, ...(example !== undefined && { example }) },
});
const dataOf = (schema: object) => ({
  type: 'object',
  required: ['data'],
  properties: { data: schema },
});
const nullable = (schema: Record<string, unknown>) => ({ ...schema, nullable: true });

const integer = (description?: string, extra: Record<string, unknown> = {}) => ({
  type: 'integer',
  ...(description && { description }),
  ...extra,
});
const counter = (description: string, maximum: number) => integer(description, { minimum: 0, maximum });
const average = (description: string) => ({ type: 'number', format: 'double', nullable: true, description });
const ratio = (description: string) => ({
  type: 'number',
  format: 'double',
  minimum: 0,
  maximum: 1,
  nullable: true,
  description: `${description} (ratio entre 0 et 1, \`null\` si aucun match).`,
});

const statisticsFields = {
  homeCorners: counter('Corners obtenus par l’équipe à domicile.', 40),
  awayCorners: counter('Corners obtenus par l’équipe à l’extérieur.', 40),
  homeShots: nullable(counter('Tirs (domicile).', 80)),
  awayShots: nullable(counter('Tirs (extérieur).', 80)),
  homeShotsOnTarget: nullable(counter('Tirs cadrés (domicile), ≤ homeShots.', 80)),
  awayShotsOnTarget: nullable(counter('Tirs cadrés (extérieur), ≤ awayShots.', 80)),
  homePossession: nullable(counter('Possession en % (domicile). Somme avec awayPossession = 100.', 100)),
  awayPossession: nullable(counter('Possession en % (extérieur).', 100)),
  homeFouls: nullable(counter('Fautes (domicile).', 60)),
  awayFouls: nullable(counter('Fautes (extérieur).', 60)),
  homeYellowCards: nullable(counter('Cartons jaunes (domicile).', 15)),
  awayYellowCards: nullable(counter('Cartons jaunes (extérieur).', 15)),
  homeRedCards: nullable(counter('Cartons rouges (domicile).', 5)),
  awayRedCards: nullable(counter('Cartons rouges (extérieur).', 5)),
};

const teamFields = {
  name: { type: 'string', minLength: 2, maxLength: 100, example: 'Olympique de Marseille' },
  shortName: { type: 'string', minLength: 2, maxLength: 10, description: 'Converti en majuscules.', example: 'OM' },
  country: { type: 'string', minLength: 2, maxLength: 60, example: 'France' },
  city: { type: 'string', maxLength: 80, nullable: true, example: 'Marseille' },
  stadium: { type: 'string', maxLength: 120, nullable: true, example: 'Orange Vélodrome' },
  foundedYear: { type: 'integer', minimum: 1850, nullable: true, example: 1899 },
};

const matchFields = {
  competition: { type: 'string', minLength: 2, maxLength: 80, example: 'Ligue 1' },
  season: { type: 'string', pattern: '^\\d{4}(\\/\\d{4})?$', example: '2026/2027' },
  matchday: { type: 'integer', minimum: 1, maximum: 60, nullable: true, example: 9 },
  kickoffAt: { type: 'string', format: 'date-time', description: 'Coup d’envoi (ISO 8601).', example: '2026-10-18T19:00:00Z' },
  venue: { type: 'string', maxLength: 120, nullable: true, example: 'Orange Vélodrome' },
  status: ref('MatchStatus'),
  homeTeamId: { type: 'integer', minimum: 1, example: 2 },
  awayTeamId: { type: 'integer', minimum: 1, example: 1 },
  homeScore: { type: 'integer', minimum: 0, maximum: 30, nullable: true, example: 2 },
  awayScore: { type: 'integer', minimum: 0, maximum: 30, nullable: true, example: 1 },
  homeHalfScore: { type: 'integer', minimum: 0, maximum: 30, nullable: true, example: 1 },
  awayHalfScore: { type: 'integer', minimum: 0, maximum: 30, nullable: true, example: 0 },
};

const timestamps = {
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
};

const analyticsFilterParams = [param('Competition'), param('Season'), param('From'), param('To')];

const teamExample = {
  id: 2,
  name: 'Olympique de Marseille',
  shortName: 'OM',
  country: 'France',
  city: 'Marseille',
  stadium: 'Orange Vélodrome',
  foundedYear: 1899,
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
};

const statisticsExample = {
  matchId: 42,
  homeCorners: 7,
  awayCorners: 4,
  homeShots: 15,
  awayShots: 9,
  homeShotsOnTarget: 6,
  awayShotsOnTarget: 3,
  homePossession: 56,
  awayPossession: 44,
  homeFouls: 11,
  awayFouls: 14,
  homeYellowCards: 2,
  awayYellowCards: 3,
  homeRedCards: 0,
  awayRedCards: 0,
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
};

const matchExample = {
  id: 42,
  competition: 'Ligue 1',
  season: '2026/2027',
  matchday: 8,
  kickoffAt: '2026-10-04T19:00:00.000Z',
  venue: 'Orange Vélodrome',
  status: 'FINISHED',
  homeTeamId: 2,
  awayTeamId: 1,
  homeScore: 2,
  awayScore: 1,
  homeHalfScore: 1,
  awayHalfScore: 0,
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
  homeTeam: { id: 2, name: 'Olympique de Marseille', shortName: 'OM' },
  awayTeam: { id: 1, name: 'Paris Saint-Germain', shortName: 'PSG' },
  statistics: statisticsExample,
};

const splitExample = {
  played: 9,
  wins: 6,
  draws: 2,
  losses: 1,
  points: 20,
  goalsFor: 19,
  goalsAgainst: 8,
  avgGoalsFor: 2.11,
  avgGoalsAgainst: 0.89,
  avgTotalGoals: 3,
  over25Rate: 0.5556,
  bttsRate: 0.4444,
  cleanSheetRate: 0.4444,
  corners: { matchesWithData: 9, avgFor: 6.22, avgAgainst: 3.78, avgTotal: 10 },
};

const aiErrorResponses = {
  429: response('TooManyRequests'),
  502: response('AiUpstreamError'),
  503: response('AiNotConfigured'),
  504: response('AiTimeout'),
};

const aiAnswerExample = {
  analysis:
    '## Olympique Lyonnais – Paris Saint-Germain\n\n**Forme récente** : le PSG reste sur 4 victoires en 5 matchs (2,2 buts marqués par match)...',
  context: { match: { id: 116, homeTeam: { id: 5, name: 'Olympique Lyonnais', shortName: 'OL' } }, '...': '...' },
  model: 'openai/gpt-oss-120b',
  usage: { promptTokens: 1210, completionTokens: 420, totalTokens: 1630 },
  generatedAt: '2026-10-16T17:00:00.000Z',
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'SportStats API',
    version: '1.0.0',
    description: [
      'API REST de centralisation, d’organisation et d’analyse de données sportives',
      '(buts, corners, statistiques de matchs), exploitable par des algorithmes d’analyse.',
      '',
      '**Conventions**',
      '- Réponses unitaires : `{ "data": { ... } }` ; listes paginées : `{ "data": [...], "meta": { page, limit, total, totalPages } }`.',
      '- Erreurs : `{ "error": { "code", "message", "details?" } }`.',
      '- Les dates sont en UTC (ISO 8601). Les filtres `from` / `to` acceptent `YYYY-MM-DD` (journée entière incluse pour `to`) ou une date-heure ISO 8601.',
      '- Les analytics ne prennent en compte que les matchs `FINISHED` avec un score.',
    ].join('\n'),
  },
  servers: [
    { url: '/', description: 'Serveur courant' },
    { url: `http://localhost:${env.PORT}`, description: 'Développement local' },
  ],
  tags: [
    { name: 'Teams', description: 'Gestion des équipes.' },
    { name: 'Matches', description: 'Gestion des matchs, filtres avancés.' },
    { name: 'Statistics', description: 'Statistiques détaillées d’un match (corners, tirs, possession, cartons).' },
    { name: 'Analytics', description: 'Agrégations : moyennes buts/corners, taux +2.5 buts, BTTS, répartition 1N2.' },
    {
      name: 'AI',
      description:
        'Analyses rédigées par un modèle de langage (Groq par défaut) à partir des statistiques calculées par l’API. Nécessite `AI_API_KEY`. Limité à `AI_RATE_LIMIT_PER_MINUTE` appels par minute et par IP.',
    },
    { name: 'System', description: 'Supervision.' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'État de santé de l’API et de la base de données',
        operationId: 'getHealth',
        responses: {
          200: { description: 'API et base de données opérationnelles.', content: json(ref('Health')) },
          503: { description: 'Base de données injoignable.', content: json(ref('Health')) },
        },
      },
    },

    '/api/v1/teams': {
      get: {
        tags: ['Teams'],
        summary: 'Lister les équipes',
        operationId: 'listTeams',
        parameters: [
          param('Page'),
          param('Limit'),
          { name: 'search', in: 'query', description: 'Recherche (insensible à la casse) sur le nom, le nom court ou la ville.', schema: { type: 'string' } },
          { name: 'country', in: 'query', description: 'Filtrer par pays (insensible à la casse).', schema: { type: 'string' }, example: 'France' },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['name', 'foundedYear', 'createdAt'], default: 'name' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
        ],
        responses: {
          200: { description: 'Liste paginée des équipes.', content: json(ref('TeamList')) },
          400: response('ValidationError'),
        },
      },
      post: {
        tags: ['Teams'],
        summary: 'Créer une équipe',
        operationId: 'createTeam',
        requestBody: { required: true, content: json(ref('TeamInput')) },
        responses: {
          201: {
            description: 'Équipe créée. L’en-tête `Location` pointe vers la ressource.',
            headers: { Location: { schema: { type: 'string' }, description: 'URL de la nouvelle équipe.' } },
            content: json(dataOf(ref('Team')), { data: teamExample }),
          },
          400: response('ValidationError'),
          409: response('Conflict'),
        },
      },
    },
    '/api/v1/teams/{id}': {
      parameters: [param('Id')],
      get: {
        tags: ['Teams'],
        summary: 'Obtenir une équipe',
        operationId: 'getTeam',
        responses: {
          200: { description: 'Équipe trouvée.', content: json(dataOf(ref('Team')), { data: teamExample }) },
          400: response('ValidationError'),
          404: response('NotFound'),
        },
      },
      patch: {
        tags: ['Teams'],
        summary: 'Modifier partiellement une équipe',
        operationId: 'updateTeam',
        requestBody: { required: true, content: json(ref('TeamUpdate')) },
        responses: {
          200: { description: 'Équipe mise à jour.', content: json(dataOf(ref('Team'))) },
          400: response('ValidationError'),
          404: response('NotFound'),
          409: response('Conflict'),
        },
      },
      delete: {
        tags: ['Teams'],
        summary: 'Supprimer une équipe',
        description: 'Refusé (`409 TEAM_HAS_MATCHES`) si l’équipe est associée à au moins un match.',
        operationId: 'deleteTeam',
        responses: {
          204: { description: 'Équipe supprimée.' },
          400: response('ValidationError'),
          404: response('NotFound'),
          409: response('Conflict'),
        },
      },
    },

    '/api/v1/matches': {
      get: {
        tags: ['Matches'],
        summary: 'Lister les matchs (filtres avancés)',
        description: 'Tous les filtres sont combinables (ET logique). Tri par date de coup d’envoi.',
        operationId: 'listMatches',
        parameters: [
          param('Page'),
          param('Limit'),
          { name: 'teamId', in: 'query', description: 'Matchs impliquant cette équipe (domicile ou extérieur).', schema: { type: 'integer', minimum: 1 } },
          { name: 'homeTeamId', in: 'query', description: 'Équipe à domicile.', schema: { type: 'integer', minimum: 1 } },
          { name: 'awayTeamId', in: 'query', description: 'Équipe à l’extérieur.', schema: { type: 'integer', minimum: 1 } },
          {
            name: 'status',
            in: 'query',
            description: 'Un ou plusieurs statuts séparés par des virgules.',
            schema: { type: 'string' },
            example: 'FINISHED,LIVE',
          },
          { name: 'date', in: 'query', description: 'Matchs d’une journée précise (UTC).', schema: { type: 'string', format: 'date' }, example: '2026-10-04' },
          param('From'),
          param('To'),
          param('Competition'),
          param('Season'),
          { name: 'matchday', in: 'query', description: 'Numéro de journée.', schema: { type: 'integer', minimum: 1 } },
          { name: 'order', in: 'query', description: 'Ordre de tri sur `kickoffAt`.', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: {
          200: { description: 'Liste paginée des matchs.', content: json(ref('MatchList')) },
          400: response('ValidationError'),
        },
      },
      post: {
        tags: ['Matches'],
        summary: 'Créer un match',
        description: [
          'Règles métier :',
          '- `homeTeamId` ≠ `awayTeamId`, et les deux équipes doivent exister ;',
          '- un match `FINISHED` doit avoir un score ; un match `SCHEDULED` / `POSTPONED` / `CANCELLED` ne peut avoir ni score ni statistiques ;',
          '- les scores (et scores à la mi-temps) sont fournis par paire ; le score à la mi-temps ne dépasse pas le score final.',
        ].join('\n'),
        operationId: 'createMatch',
        requestBody: {
          required: true,
          content: json(ref('MatchInput'), {
            competition: 'Ligue 1',
            season: '2026/2027',
            matchday: 8,
            kickoffAt: '2026-10-04T19:00:00Z',
            venue: 'Orange Vélodrome',
            status: 'FINISHED',
            homeTeamId: 2,
            awayTeamId: 1,
            homeScore: 2,
            awayScore: 1,
            homeHalfScore: 1,
            awayHalfScore: 0,
            statistics: { homeCorners: 7, awayCorners: 4, homeShots: 15, awayShots: 9, homePossession: 56, awayPossession: 44 },
          }),
        },
        responses: {
          201: {
            description: 'Match créé.',
            headers: { Location: { schema: { type: 'string' }, description: 'URL du nouveau match.' } },
            content: json(dataOf(ref('Match')), { data: matchExample }),
          },
          400: response('ValidationError'),
        },
      },
    },
    '/api/v1/matches/{id}': {
      parameters: [param('Id')],
      get: {
        tags: ['Matches'],
        summary: 'Obtenir un match (équipes et statistiques incluses)',
        operationId: 'getMatch',
        responses: {
          200: { description: 'Match trouvé.', content: json(dataOf(ref('Match')), { data: matchExample }) },
          400: response('ValidationError'),
          404: response('NotFound'),
        },
      },
      patch: {
        tags: ['Matches'],
        summary: 'Modifier partiellement un match',
        description: 'Les règles métier sont vérifiées sur l’état résultant (match existant + modifications).',
        operationId: 'updateMatch',
        requestBody: {
          required: true,
          content: json(ref('MatchUpdate'), { status: 'FINISHED', homeScore: 3, awayScore: 1 }),
        },
        responses: {
          200: { description: 'Match mis à jour.', content: json(dataOf(ref('Match'))) },
          400: response('ValidationError'),
          404: response('NotFound'),
        },
      },
      delete: {
        tags: ['Matches'],
        summary: 'Supprimer un match (et ses statistiques)',
        operationId: 'deleteMatch',
        responses: {
          204: { description: 'Match supprimé.' },
          400: response('ValidationError'),
          404: response('NotFound'),
        },
      },
    },
    '/api/v1/matches/{id}/statistics': {
      parameters: [param('Id')],
      get: {
        tags: ['Statistics'],
        summary: 'Obtenir les statistiques d’un match',
        operationId: 'getMatchStatistics',
        responses: {
          200: { description: 'Statistiques du match.', content: json(dataOf(ref('MatchStatistics')), { data: statisticsExample }) },
          400: response('ValidationError'),
          404: response('NotFound'),
        },
      },
      put: {
        tags: ['Statistics'],
        summary: 'Créer ou remplacer les statistiques d’un match',
        description: 'Sémantique PUT : les champs optionnels absents sont remis à `null`. Réservé aux matchs `LIVE` ou `FINISHED`.',
        operationId: 'upsertMatchStatistics',
        requestBody: { required: true, content: json(ref('MatchStatisticsInput')) },
        responses: {
          200: { description: 'Statistiques remplacées.', content: json(dataOf(ref('MatchStatistics'))) },
          201: { description: 'Statistiques créées.', content: json(dataOf(ref('MatchStatistics'))) },
          400: response('ValidationError'),
          404: response('NotFound'),
          409: response('Conflict'),
        },
      },
      delete: {
        tags: ['Statistics'],
        summary: 'Supprimer les statistiques d’un match',
        operationId: 'deleteMatchStatistics',
        responses: {
          204: { description: 'Statistiques supprimées.' },
          400: response('ValidationError'),
          404: response('NotFound'),
        },
      },
    },

    '/api/v1/stats/overview': {
      get: {
        tags: ['Analytics'],
        summary: 'Statistiques globales (moyennes buts/corners, +2.5 buts, BTTS, 1N2)',
        description: 'Agrégations calculées en SQL sur les matchs terminés correspondant aux filtres.',
        operationId: 'getOverviewStats',
        parameters: [
          ...analyticsFilterParams,
          { name: 'teamId', in: 'query', description: 'Restreindre aux matchs de cette équipe.', schema: { type: 'integer', minimum: 1 } },
        ],
        responses: {
          200: {
            description: 'Agrégats.',
            content: json(dataOf(ref('OverviewStats')), {
              data: {
                filters: { competition: 'Ligue 1', season: '2025/2026' },
                matches: 90,
                goals: { home: 1.62, away: 1.18, total: 2.8, over15Rate: 0.7667, over25Rate: 0.5222, bttsRate: 0.5111 },
                corners: { matchesWithData: 90, home: 5.41, away: 4.37, total: 9.78, over95Rate: 0.5 },
                results: { homeWinRate: 0.4556, drawRate: 0.2556, awayWinRate: 0.2889 },
              },
            }),
          },
          400: response('ValidationError'),
          404: response('NotFound'),
        },
      },
    },
    '/api/v1/stats/standings': {
      get: {
        tags: ['Analytics'],
        summary: 'Classement avec statistiques domicile / extérieur',
        description: 'Tri : points, différence de buts, buts marqués. Seules les équipes ayant joué un match correspondant aux filtres apparaissent.',
        operationId: 'getStandings',
        parameters: analyticsFilterParams,
        responses: {
          200: { description: 'Classement.', content: json(dataOf(ref('Standings'))) },
          400: response('ValidationError'),
        },
      },
    },
    '/api/v1/stats/teams/{id}': {
      parameters: [param('Id')],
      get: {
        tags: ['Analytics'],
        summary: 'Statistiques d’une équipe (global / domicile / extérieur)',
        description: 'Moyennes de buts et corners pour/contre, bilan V/N/D, taux +2.5 buts, BTTS et clean sheets.',
        operationId: 'getTeamStats',
        parameters: [
          ...analyticsFilterParams,
          {
            name: 'last',
            in: 'query',
            description: 'Ne considérer que les N derniers matchs terminés (forme récente).',
            schema: { type: 'integer', minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          200: {
            description: 'Statistiques de l’équipe.',
            content: json(dataOf(ref('TeamStats')), {
              data: {
                team: { id: 1, name: 'Paris Saint-Germain', shortName: 'PSG' },
                filters: { season: '2026/2027' },
                overall: splitExample,
                home: { ...splitExample, played: 5 },
                away: { ...splitExample, played: 4 },
              },
            }),
          },
          400: response('ValidationError'),
          404: response('NotFound'),
        },
      },
    },

    '/api/v1/ai/matches/{id}/preview': {
      parameters: [param('Id')],
      get: {
        tags: ['AI'],
        summary: 'Analyse d’avant-match générée par l’IA',
        description: [
          'L’IA reçoit la forme récente (5 derniers matchs) des deux équipes, leurs statistiques domicile/extérieur de la saison,',
          'les confrontations directes et les moyennes du championnat — uniquement des données antérieures au coup d’envoi —',
          'et rédige une analyse avec des tendances chiffrées (1N2, +2.5 buts, BTTS, +9.5 corners).',
          'Disponible pour les matchs `SCHEDULED`, `POSTPONED` et `LIVE`. Les données transmises sont renvoyées dans `context`.',
        ].join(' '),
        operationId: 'getMatchPreview',
        responses: {
          200: { description: 'Analyse générée.', content: json(dataOf(ref('AiAnswer')), { data: aiAnswerExample }) },
          400: response('ValidationError'),
          404: response('NotFound'),
          409: response('Conflict'),
          ...aiErrorResponses,
        },
      },
    },
    '/api/v1/ai/teams/{id}/summary': {
      parameters: [param('Id')],
      get: {
        tags: ['AI'],
        summary: 'Résumé des performances d’une équipe généré par l’IA',
        description: 'Mêmes filtres que `GET /api/v1/stats/teams/{id}` ; les 5 derniers résultats sont ajoutés au contexte.',
        operationId: 'getTeamSummary',
        parameters: [
          ...analyticsFilterParams,
          {
            name: 'last',
            in: 'query',
            description: 'Ne considérer que les N derniers matchs terminés.',
            schema: { type: 'integer', minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          200: { description: 'Résumé généré.', content: json(dataOf(ref('AiAnswer'))) },
          400: response('ValidationError'),
          404: response('NotFound'),
          ...aiErrorResponses,
        },
      },
    },
    '/api/v1/ai/ask': {
      post: {
        tags: ['AI'],
        summary: 'Poser une question en langage naturel sur les données',
        description: [
          'L’IA répond à partir du classement (avec splits domicile/extérieur), des moyennes du championnat,',
          'des 15 derniers résultats et des 10 prochains matchs de la saison demandée',
          '(par défaut : la saison la plus récente ayant des matchs terminés).',
        ].join(' '),
        operationId: 'askQuestion',
        requestBody: {
          required: true,
          content: json(ref('AskInput'), { question: 'Quelle équipe obtient le plus de corners à domicile ?', season: '2026/2027' }),
        },
        responses: {
          200: { description: 'Réponse générée.', content: json(dataOf(ref('AiAnswer'))) },
          400: response('ValidationError'),
          404: response('NotFound'),
          ...aiErrorResponses,
        },
      },
    },
  },

  components: {
    parameters: {
      Id: { name: 'id', in: 'path', required: true, description: 'Identifiant de la ressource.', schema: { type: 'integer', minimum: 1 } },
      Page: { name: 'page', in: 'query', description: 'Numéro de page (à partir de 1).', schema: { type: 'integer', minimum: 1, default: 1 } },
      Limit: { name: 'limit', in: 'query', description: 'Éléments par page.', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      Competition: { name: 'competition', in: 'query', description: 'Compétition (insensible à la casse).', schema: { type: 'string' }, example: 'Ligue 1' },
      Season: { name: 'season', in: 'query', description: 'Saison.', schema: { type: 'string' }, example: '2026/2027' },
      From: {
        name: 'from',
        in: 'query',
        description: 'Coup d’envoi ≥ cette date (`YYYY-MM-DD` ou ISO 8601).',
        schema: { type: 'string' },
        example: '2026-08-01',
      },
      To: {
        name: 'to',
        in: 'query',
        description: 'Coup d’envoi ≤ cette date (`YYYY-MM-DD` inclut toute la journée).',
        schema: { type: 'string' },
        example: '2026-12-31',
      },
    },

    responses: {
      ValidationError: {
        description: 'Requête invalide (validation Zod ou règle métier).',
        content: json(ref('Error'), {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Les données envoyées sont invalides.',
            details: [{ path: 'body.awayTeamId', message: 'L’équipe à l’extérieur doit être différente de l’équipe à domicile.' }],
          },
        }),
      },
      NotFound: {
        description: 'Ressource introuvable.',
        content: json(ref('Error'), { error: { code: 'NOT_FOUND', message: 'Équipe introuvable (id: 999).' } }),
      },
      TooManyRequests: {
        description: 'Limite d’appels atteinte (`RATE_LIMITED` : limite de l’API ; `AI_RATE_LIMITED` : quota du fournisseur d’IA, ex. offre gratuite Groq).',
        content: json(ref('Error'), { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes vers l’IA, réessayez dans une minute.' } }),
      },
      AiUpstreamError: {
        description: 'Erreur du service d’IA (`AI_UPSTREAM_ERROR`, `AI_AUTH_ERROR`).',
        content: json(ref('Error'), { error: { code: 'AI_UPSTREAM_ERROR', message: 'Le service d’IA a renvoyé une erreur (500).' } }),
      },
      AiNotConfigured: {
        description: 'IA non configurée (`AI_NOT_CONFIGURED`) : `AI_API_KEY` absente.',
        content: json(ref('Error'), { error: { code: 'AI_NOT_CONFIGURED', message: 'L’IA n’est pas configurée : définissez AI_API_KEY (clé Groq).' } }),
      },
      AiTimeout: {
        description: 'Le service d’IA n’a pas répondu à temps (`AI_TIMEOUT`).',
        content: json(ref('Error'), { error: { code: 'AI_TIMEOUT', message: 'Le service d’IA n’a pas répondu dans le délai imparti.' } }),
      },
      Conflict: {
        description: 'Conflit avec l’état actuel de la ressource.',
        content: json(ref('Error'), {
          error: { code: 'TEAM_HAS_MATCHES', message: 'Impossible de supprimer l’équipe : elle est associée à 18 match(s).' },
        }),
      },
    },

    schemas: {
      MatchStatus: {
        type: 'string',
        enum: ['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED'],
        example: 'FINISHED',
      },

      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['path', 'message'],
                  properties: { path: { type: 'string', example: 'query.limit' }, message: { type: 'string' } },
                },
              },
            },
          },
        },
      },

      PaginationMeta: {
        type: 'object',
        required: ['page', 'limit', 'total', 'totalPages'],
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 180 },
          totalPages: { type: 'integer', example: 9 },
        },
      },

      Health: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] },
          database: { type: 'string', enum: ['up', 'down'] },
          uptime: { type: 'integer', description: 'Secondes depuis le démarrage.' },
        },
      },

      Team: {
        type: 'object',
        required: ['id', 'name', 'shortName', 'country', 'createdAt', 'updatedAt'],
        properties: { id: { type: 'integer', example: 2 }, ...teamFields, ...timestamps },
      },
      TeamInput: {
        type: 'object',
        required: ['name', 'shortName', 'country'],
        additionalProperties: false,
        properties: teamFields,
      },
      TeamUpdate: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: teamFields,
      },
      TeamSummary: {
        type: 'object',
        required: ['id', 'name', 'shortName'],
        properties: { id: { type: 'integer' }, name: { type: 'string' }, shortName: { type: 'string' } },
      },
      TeamList: {
        type: 'object',
        required: ['data', 'meta'],
        properties: { data: { type: 'array', items: ref('Team') }, meta: ref('PaginationMeta') },
      },

      MatchStatisticsInput: {
        type: 'object',
        required: ['homeCorners', 'awayCorners'],
        additionalProperties: false,
        properties: statisticsFields,
        example: {
          homeCorners: 7,
          awayCorners: 4,
          homeShots: 15,
          awayShots: 9,
          homeShotsOnTarget: 6,
          awayShotsOnTarget: 3,
          homePossession: 56,
          awayPossession: 44,
          homeYellowCards: 2,
          awayYellowCards: 3,
        },
      },
      MatchStatistics: {
        type: 'object',
        required: ['matchId', 'homeCorners', 'awayCorners', 'createdAt', 'updatedAt'],
        properties: { matchId: { type: 'integer' }, ...statisticsFields, ...timestamps },
      },

      Match: {
        type: 'object',
        required: ['id', 'competition', 'season', 'kickoffAt', 'status', 'homeTeamId', 'awayTeamId', 'homeTeam', 'awayTeam'],
        properties: {
          id: { type: 'integer', example: 42 },
          ...matchFields,
          ...timestamps,
          homeTeam: ref('TeamSummary'),
          awayTeam: ref('TeamSummary'),
          statistics: { allOf: [ref('MatchStatistics')], nullable: true },
        },
      },
      MatchInput: {
        type: 'object',
        required: ['competition', 'season', 'kickoffAt', 'homeTeamId', 'awayTeamId'],
        additionalProperties: false,
        properties: {
          ...matchFields,
          status: { allOf: [ref('MatchStatus')], default: 'SCHEDULED' },
          statistics: ref('MatchStatisticsInput'),
        },
      },
      MatchUpdate: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: matchFields,
      },
      MatchList: {
        type: 'object',
        required: ['data', 'meta'],
        properties: { data: { type: 'array', items: ref('Match') }, meta: ref('PaginationMeta') },
      },

      OverviewStats: {
        type: 'object',
        properties: {
          filters: { type: 'object', additionalProperties: true, description: 'Filtres appliqués.' },
          matches: { type: 'integer', description: 'Nombre de matchs terminés analysés.' },
          goals: {
            type: 'object',
            properties: {
              home: average('Moyenne de buts marqués par l’équipe à domicile.'),
              away: average('Moyenne de buts marqués par l’équipe à l’extérieur.'),
              total: average('Moyenne de buts par match.'),
              over15Rate: ratio('Part des matchs avec au moins 2 buts'),
              over25Rate: ratio('Part des matchs avec au moins 3 buts (+2.5)'),
              bttsRate: ratio('Part des matchs où les deux équipes marquent'),
            },
          },
          corners: {
            type: 'object',
            properties: {
              matchesWithData: { type: 'integer', description: 'Matchs disposant de statistiques de corners.' },
              home: average('Moyenne de corners (domicile).'),
              away: average('Moyenne de corners (extérieur).'),
              total: average('Moyenne de corners par match.'),
              over95Rate: ratio('Part des matchs avec au moins 10 corners (+9.5)'),
            },
          },
          results: {
            type: 'object',
            properties: {
              homeWinRate: ratio('Victoires à domicile'),
              drawRate: ratio('Matchs nuls'),
              awayWinRate: ratio('Victoires à l’extérieur'),
            },
          },
        },
      },

      TeamSplitStats: {
        type: 'object',
        properties: {
          played: integer('Matchs joués.'),
          wins: integer(),
          draws: integer(),
          losses: integer(),
          points: integer('3 pts par victoire, 1 par nul.'),
          goalsFor: integer('Buts marqués.'),
          goalsAgainst: integer('Buts encaissés.'),
          avgGoalsFor: average('Buts marqués par match.'),
          avgGoalsAgainst: average('Buts encaissés par match.'),
          avgTotalGoals: average('Buts (total) par match.'),
          over25Rate: ratio('Matchs à +2.5 buts'),
          bttsRate: ratio('Matchs où les deux équipes marquent'),
          cleanSheetRate: ratio('Matchs sans but encaissé'),
          corners: {
            type: 'object',
            properties: {
              matchesWithData: integer('Matchs disposant de statistiques de corners.'),
              avgFor: average('Corners obtenus par match.'),
              avgAgainst: average('Corners concédés par match.'),
              avgTotal: average('Corners (total) par match.'),
            },
          },
        },
      },
      StandingRow: {
        type: 'object',
        properties: {
          rank: { type: 'integer', example: 1 },
          team: ref('TeamSummary'),
          goalDifference: { type: 'integer', example: 22 },
          overall: ref('TeamSplitStats'),
          home: ref('TeamSplitStats'),
          away: ref('TeamSplitStats'),
        },
      },
      Standings: {
        type: 'object',
        properties: {
          filters: { type: 'object', additionalProperties: true, description: 'Filtres appliqués.' },
          table: { type: 'array', items: ref('StandingRow') },
        },
      },

      AskInput: {
        type: 'object',
        required: ['question'],
        additionalProperties: false,
        properties: {
          question: { type: 'string', minLength: 3, maxLength: 500, example: 'Quelle équipe obtient le plus de corners à domicile ?' },
          competition: { type: 'string', example: 'Ligue 1' },
          season: { type: 'string', description: 'Par défaut : la saison la plus récente.', example: '2026/2027' },
        },
      },
      AiAnswer: {
        type: 'object',
        required: ['analysis', 'context', 'model', 'generatedAt'],
        properties: {
          analysis: { type: 'string', description: 'Texte rédigé par le modèle (Markdown, en français).' },
          context: {
            type: 'object',
            additionalProperties: true,
            description: 'Données calculées par l’API et transmises au modèle : la réponse doit s’y appuyer.',
          },
          model: { type: 'string', example: 'openai/gpt-oss-120b' },
          usage: {
            type: 'object',
            nullable: true,
            properties: {
              promptTokens: { type: 'integer' },
              completionTokens: { type: 'integer' },
              totalTokens: { type: 'integer' },
            },
          },
          generatedAt: { type: 'string', format: 'date-time' },
        },
      },

      TeamStats: {
        type: 'object',
        properties: {
          team: ref('TeamSummary'),
          filters: { type: 'object', additionalProperties: true, description: 'Filtres appliqués.' },
          overall: ref('TeamSplitStats'),
          home: ref('TeamSplitStats'),
          away: ref('TeamSplitStats'),
        },
      },
    },
  },
} as const;
