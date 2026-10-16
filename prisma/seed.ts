/**
 * Seed script — `npm run db:seed` (or `npx prisma db seed`).
 *
 * Wipes the SportStats tables, then generates two seasons of a 10-club league
 * (double round-robin, one matchday every two weeks):
 *   - 2025/2026: fully played;
 *   - 2026/2027: matches dated before "now" are FINISHED, later ones SCHEDULED.
 *
 * Results are SIMULATED (not real results) with a Poisson model driven by each
 * club's attack/defence ratings and a home advantage, so the data has realistic
 * distributions (≈2.7 goals and ≈10 corners per match, home bias, strong teams
 * winning more...). A fixed PRNG seed makes every run produce the same data.
 */
import { prisma } from '../src/config/database.js';
import type { Prisma, Team } from '../src/generated/prisma/client.js';

// ---------------------------------------------------------------------------
// Deterministic random helpers
// ---------------------------------------------------------------------------

/** mulberry32: tiny, fast, seedable PRNG. */
const createRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const random = createRandom(20260816);

/** Knuth's algorithm — fine for the small lambdas used here. */
const poisson = (lambda: number) => {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= random();
  } while (p > limit);
  return k - 1;
};

const binomial = (n: number, p: number) => {
  let successes = 0;
  for (let i = 0; i < n; i += 1) if (random() < p) successes += 1;
  return successes;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

interface ClubSeed extends Prisma.TeamCreateInput {
  /** > 1 means the club scores more than an average side. */
  attack: number;
  /** < 1 means the club concedes less than an average side. */
  defence: number;
}

const CLUBS: ClubSeed[] = [
  { name: 'Paris Saint-Germain', shortName: 'PSG', country: 'France', city: 'Paris', stadium: 'Parc des Princes', foundedYear: 1970, attack: 1.45, defence: 0.7 },
  { name: 'Olympique de Marseille', shortName: 'OM', country: 'France', city: 'Marseille', stadium: 'Orange Vélodrome', foundedYear: 1899, attack: 1.2, defence: 0.9 },
  { name: 'AS Monaco', shortName: 'ASM', country: 'Monaco', city: 'Monaco', stadium: 'Stade Louis-II', foundedYear: 1924, attack: 1.2, defence: 0.95 },
  { name: 'LOSC Lille', shortName: 'LOSC', country: 'France', city: 'Lille', stadium: 'Stade Pierre-Mauroy', foundedYear: 1944, attack: 1.1, defence: 0.85 },
  { name: 'Olympique Lyonnais', shortName: 'OL', country: 'France', city: 'Lyon', stadium: 'Groupama Stadium', foundedYear: 1950, attack: 1.15, defence: 1.0 },
  { name: 'OGC Nice', shortName: 'OGCN', country: 'France', city: 'Nice', stadium: 'Allianz Riviera', foundedYear: 1904, attack: 1.0, defence: 0.95 },
  { name: 'RC Lens', shortName: 'RCL', country: 'France', city: 'Lens', stadium: 'Stade Bollaert-Delelis', foundedYear: 1906, attack: 1.05, defence: 0.9 },
  { name: 'Stade Rennais FC', shortName: 'SRFC', country: 'France', city: 'Rennes', stadium: 'Roazhon Park', foundedYear: 1901, attack: 1.0, defence: 1.05 },
  { name: 'Stade Brestois 29', shortName: 'SB29', country: 'France', city: 'Brest', stadium: 'Stade Francis-Le Blé', foundedYear: 1950, attack: 0.9, defence: 1.1 },
  { name: 'FC Nantes', shortName: 'FCN', country: 'France', city: 'Nantes', stadium: 'Stade de la Beaujoire', foundedYear: 1943, attack: 0.8, defence: 1.2 },
];

const COMPETITION = 'Ligue 1';
const SEASONS = [
  { season: '2025/2026', firstMatchday: '2025-08-15' },
  { season: '2026/2027', firstMatchday: '2026-08-14' },
];
const DAYS_BETWEEN_MATCHDAYS = 14;

/** Kick-off slots of a matchday (UTC), relative to its Friday. */
const KICKOFF_SLOTS = [
  { dayOffset: 0, hour: 19, minute: 0 },
  { dayOffset: 1, hour: 15, minute: 0 },
  { dayOffset: 1, hour: 19, minute: 0 },
  { dayOffset: 2, hour: 13, minute: 0 },
  { dayOffset: 2, hour: 18, minute: 45 },
];

const LEAGUE_HOME_GOALS = 1.5;
const LEAGUE_AWAY_GOALS = 1.2;
const LEAGUE_HOME_CORNERS = 4.6;
const LEAGUE_AWAY_CORNERS = 4.0;

// ---------------------------------------------------------------------------
// Fixtures & simulation
// ---------------------------------------------------------------------------

/** Circle-method round-robin; the second half mirrors the first with venues swapped. */
const buildDoubleRoundRobin = (teamCount: number): [number, number][][] => {
  const rotation = Array.from({ length: teamCount }, (_, i) => i);
  const firstHalf: [number, number][][] = [];

  for (let round = 0; round < teamCount - 1; round += 1) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < teamCount / 2; i += 1) {
      const a = rotation[i]!;
      const b = rotation[teamCount - 1 - i]!;
      // Alternate venues so that each club gets a balanced home/away sequence.
      pairs.push((round + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    firstHalf.push(pairs);
    rotation.splice(1, 0, rotation.pop()!);
  }

  const secondHalf = firstHalf.map((pairs) => pairs.map(([home, away]) => [away, home] as [number, number]));
  return [...firstHalf, ...secondHalf];
};

const simulateMatch = (home: ClubSeed, away: ClubSeed) => {
  const homeGoals = poisson(LEAGUE_HOME_GOALS * home.attack * away.defence);
  const awayGoals = poisson(LEAGUE_AWAY_GOALS * away.attack * home.defence);
  const homeHalfGoals = binomial(homeGoals, 0.45);
  const awayHalfGoals = binomial(awayGoals, 0.45);

  // Stronger attacking sides dominate the ball and win more corners.
  const dominance = home.attack / home.defence - away.attack / away.defence;
  const homePossession = Math.round(clamp(52 + dominance * 9 + (random() - 0.5) * 12, 28, 74));

  const shots = (lambda: number, goals: number) => {
    const onTarget = Math.max(goals, poisson(lambda * 0.36));
    return { total: Math.max(onTarget, poisson(lambda)), onTarget };
  };
  const homeShots = shots(12.5 * home.attack * away.defence, homeGoals);
  const awayShots = shots(10.5 * away.attack * home.defence, awayGoals);

  const statistics = {
    homeCorners: poisson(LEAGUE_HOME_CORNERS * home.attack * (0.6 + 0.4 * away.defence)),
    awayCorners: poisson(LEAGUE_AWAY_CORNERS * away.attack * (0.6 + 0.4 * home.defence)),
    homeShots: homeShots.total,
    awayShots: awayShots.total,
    homeShotsOnTarget: homeShots.onTarget,
    awayShotsOnTarget: awayShots.onTarget,
    homePossession,
    awayPossession: 100 - homePossession,
    homeFouls: poisson(11.5),
    awayFouls: poisson(12.5),
    homeYellowCards: poisson(1.7),
    awayYellowCards: poisson(2.1),
    homeRedCards: random() < 0.05 ? 1 : 0,
    awayRedCards: random() < 0.07 ? 1 : 0,
  };

  return { homeGoals, awayGoals, homeHalfGoals, awayHalfGoals, statistics };
};

const kickoffDate = (firstMatchday: string, matchdayIndex: number, slotIndex: number) => {
  const slot = KICKOFF_SLOTS[slotIndex % KICKOFF_SLOTS.length]!;
  const date = new Date(`${firstMatchday}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + matchdayIndex * DAYS_BETWEEN_MATCHDAYS + slot.dayOffset);
  date.setUTCHours(slot.hour, slot.minute, 0, 0);
  return date;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async () => {
  const now = new Date();
  console.log('🧹 Nettoyage des tables...');
  await prisma.$executeRaw`TRUNCATE TABLE match_statistics, matches, teams RESTART IDENTITY CASCADE`;

  console.log(`🏟️  Création de ${CLUBS.length} équipes...`);
  const teams: Team[] = [];
  for (const { attack: _attack, defence: _defence, ...team } of CLUBS) {
    teams.push(await prisma.team.create({ data: team }));
  }

  const fixtures = buildDoubleRoundRobin(CLUBS.length);
  const matches: Prisma.MatchCreateInput[] = [];

  for (const { season, firstMatchday } of SEASONS) {
    let postponedOne = false;

    fixtures.forEach((pairs, matchdayIndex) => {
      pairs.forEach(([homeIndex, awayIndex], slotIndex) => {
        const home = CLUBS[homeIndex]!;
        const away = CLUBS[awayIndex]!;
        const kickoffAt = kickoffDate(firstMatchday, matchdayIndex, slotIndex);
        // Simulate every fixture (even future ones) so the PRNG sequence, hence the data, is stable.
        const result = simulateMatch(home, away);

        const base = {
          competition: COMPETITION,
          season,
          matchday: matchdayIndex + 1,
          kickoffAt,
          venue: home.stadium ?? null,
          homeTeam: { connect: { id: teams[homeIndex]!.id } },
          awayTeam: { connect: { id: teams[awayIndex]!.id } },
        };

        if (kickoffAt > now) {
          matches.push({ ...base, status: 'SCHEDULED' });
        } else if (!postponedOne && season === '2026/2027' && matchdayIndex === 2 && slotIndex === 4) {
          // One weather-related postponement keeps the data set realistic.
          postponedOne = true;
          matches.push({ ...base, status: 'POSTPONED' });
        } else {
          matches.push({
            ...base,
            status: 'FINISHED',
            homeScore: result.homeGoals,
            awayScore: result.awayGoals,
            homeHalfScore: result.homeHalfGoals,
            awayHalfScore: result.awayHalfGoals,
            statistics: { create: result.statistics },
          });
        }
      });
    });
  }

  console.log(`⚽ Création de ${matches.length} matchs et de leurs statistiques...`);
  await prisma.$transaction(matches.map((data) => prisma.match.create({ data })));

  const [finished, scheduled] = await Promise.all([
    prisma.match.count({ where: { status: 'FINISHED' } }),
    prisma.match.count({ where: { status: 'SCHEDULED' } }),
  ]);
  console.log(`✅ Seed terminé : ${teams.length} équipes, ${finished} matchs terminés, ${scheduled} matchs programmés.`);
};

main()
  .catch((error: unknown) => {
    console.error('❌ Échec du seed :', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
