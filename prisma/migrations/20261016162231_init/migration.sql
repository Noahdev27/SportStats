-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED');

-- CreateTable
CREATE TABLE "teams" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "short_name" VARCHAR(10) NOT NULL,
    "country" VARCHAR(60) NOT NULL,
    "city" VARCHAR(80),
    "stadium" VARCHAR(120),
    "founded_year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" SERIAL NOT NULL,
    "competition" VARCHAR(80) NOT NULL,
    "season" VARCHAR(9) NOT NULL,
    "matchday" INTEGER,
    "kickoff_at" TIMESTAMP(3) NOT NULL,
    "venue" VARCHAR(120),
    "status" "match_status" NOT NULL DEFAULT 'SCHEDULED',
    "home_team_id" INTEGER NOT NULL,
    "away_team_id" INTEGER NOT NULL,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "home_half_score" INTEGER,
    "away_half_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_statistics" (
    "match_id" INTEGER NOT NULL,
    "home_corners" INTEGER NOT NULL,
    "away_corners" INTEGER NOT NULL,
    "home_shots" INTEGER,
    "away_shots" INTEGER,
    "home_shots_on_target" INTEGER,
    "away_shots_on_target" INTEGER,
    "home_possession" INTEGER,
    "away_possession" INTEGER,
    "home_fouls" INTEGER,
    "away_fouls" INTEGER,
    "home_yellow_cards" INTEGER,
    "away_yellow_cards" INTEGER,
    "home_red_cards" INTEGER,
    "away_red_cards" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_statistics_pkey" PRIMARY KEY ("match_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE INDEX "teams_country_idx" ON "teams"("country");

-- CreateIndex
CREATE INDEX "matches_home_team_id_kickoff_at_idx" ON "matches"("home_team_id", "kickoff_at");

-- CreateIndex
CREATE INDEX "matches_away_team_id_kickoff_at_idx" ON "matches"("away_team_id", "kickoff_at");

-- CreateIndex
CREATE INDEX "matches_status_kickoff_at_idx" ON "matches"("status", "kickoff_at");

-- CreateIndex
CREATE INDEX "matches_competition_season_idx" ON "matches"("competition", "season");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_statistics" ADD CONSTRAINT "match_statistics_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integrity constraints (not expressible in the Prisma schema)
ALTER TABLE "matches" ADD CONSTRAINT "matches_distinct_teams_check" CHECK ("home_team_id" <> "away_team_id");
ALTER TABLE "matches" ADD CONSTRAINT "matches_scores_check" CHECK (
  ("home_score" IS NULL OR "home_score" >= 0) AND ("away_score" IS NULL OR "away_score" >= 0)
  AND ("home_half_score" IS NULL OR "home_half_score" >= 0) AND ("away_half_score" IS NULL OR "away_half_score" >= 0)
);
ALTER TABLE "match_statistics" ADD CONSTRAINT "match_statistics_corners_check" CHECK ("home_corners" >= 0 AND "away_corners" >= 0);
ALTER TABLE "match_statistics" ADD CONSTRAINT "match_statistics_possession_check" CHECK (
  ("home_possession" IS NULL OR "home_possession" BETWEEN 0 AND 100) AND ("away_possession" IS NULL OR "away_possession" BETWEEN 0 AND 100)
);
