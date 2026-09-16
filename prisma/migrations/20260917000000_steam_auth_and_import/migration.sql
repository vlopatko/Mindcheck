-- Remove the global date uniqueness before records become user-owned.
DROP INDEX "DailyLog_date_key";
DROP INDEX "Match_steamMatchId_key";

ALTER TABLE "DailyLog" ADD COLUMN "userId" TEXT;

CREATE TABLE "SteamUser" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "lastShareCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SteamUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SteamAuthSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SteamAuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SteamUser_steamId_key" ON "SteamUser"("steamId");
CREATE UNIQUE INDEX "SteamAuthSession_tokenHash_key" ON "SteamAuthSession"("tokenHash");
CREATE INDEX "SteamAuthSession_userId_expiresAt_idx" ON "SteamAuthSession"("userId", "expiresAt");
CREATE UNIQUE INDEX "DailyLog_userId_date_key" ON "DailyLog"("userId", "date");
CREATE INDEX "DailyLog_userId_date_idx" ON "DailyLog"("userId", "date");
CREATE INDEX "Match_steamMatchId_idx" ON "Match"("steamMatchId");

ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "SteamUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SteamAuthSession" ADD CONSTRAINT "SteamAuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "SteamUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
