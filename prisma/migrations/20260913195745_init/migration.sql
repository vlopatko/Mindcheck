-- CreateEnum
CREATE TYPE "CaffeineLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "MatchResult" AS ENUM ('WIN', 'LOSS', 'DRAW');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('VALVE', 'FACEIT');

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sleepOk" BOOLEAN,
    "sleepHours" DOUBLE PRECISION,
    "sleepQuality" INTEGER,
    "physicalActivity" BOOLEAN,
    "discipline" BOOLEAN,
    "ateBeforeSession" BOOLEAN,
    "hydrated" BOOLEAN,
    "caffeine" "CaffeineLevel",
    "nicotine" BOOLEAN,
    "alcoholYesterday" BOOLEAN,
    "energy" INTEGER,
    "focus" INTEGER,
    "mood" INTEGER,
    "stress" INTEGER,
    "tilt" INTEGER,
    "warmup" BOOLEAN,
    "warmupMinutes" INTEGER,
    "aimTraining" BOOLEAN,
    "dm" BOOLEAN,
    "confidence" INTEGER,
    "notes" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "dailyLogId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'VALVE',
    "map" TEXT,
    "result" "MatchResult",
    "teamScore" INTEGER,
    "enemyScore" INTEGER,
    "kills" INTEGER,
    "deaths" INTEGER,
    "assists" INTEGER,
    "adr" DOUBLE PRECISION,
    "headshot" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "performance" INTEGER,
    "aim" INTEGER,
    "movement" INTEGER,
    "decisions" INTEGER,
    "communication" INTEGER,
    "focusAfter" INTEGER,
    "confidenceAfter" INTEGER,
    "tilted" BOOLEAN,
    "tired" BOOLEAN,
    "notes" TEXT,
    "steamMatchId" TEXT,
    "shareCode" TEXT,
    "demoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_date_key" ON "DailyLog"("date");

-- CreateIndex
CREATE INDEX "Session_dailyLogId_startedAt_idx" ON "Session"("dailyLogId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Match_steamMatchId_key" ON "Match"("steamMatchId");

-- CreateIndex
CREATE INDEX "Match_sessionId_playedAt_idx" ON "Match"("sessionId", "playedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "DailyLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
