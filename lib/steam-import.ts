import SteamUserClient from "steam-user";
import GlobalOffensive from "globaloffensive";
import { Readable } from "node:stream";
import { DemoReader } from "cs2parser";
import unbzip2Stream from "unbzip2-stream";

type UnknownRecord = Record<string, unknown>;

export type ImportedSteamMatch = {
  steamMatchId: string;
  shareCode: string | null;
  playedAt: Date;
  map: string | null;
  teamScore: number | null;
  enemyScore: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  headshot: number | null;
  demoUrl: string | null;
  result: "WIN" | "LOSS" | "DRAW" | null;
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function numberArray(value: unknown) {
  return Array.isArray(value) ? value.map(Number) : [];
}

function idString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "bigint" || typeof value === "number") return String(value);
  const record = asRecord(value);
  return typeof record.toString === "function" ? String(record.toString()) : "";
}

export async function sharingCodes(
  steamId: string,
  authCode: string,
  firstCode: string,
  limit = 10,
) {
  const apiKey = process.env.STEAM_WEB_API_KEY;
  if (!apiKey) throw new Error("STEAM_WEB_API_KEY is not configured.");
  const codes = [firstCode];
  while (codes.length < limit) {
    const params = new URLSearchParams({
      key: apiKey,
      steamid: steamId,
      steamidkey: authCode,
      knowncode: codes.at(-1)!,
      format: "json",
    });
    const response = await fetch(
      `https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1/?${params}`,
      { cache: "no-store" },
    );
    const body = await response.text();
    if (!response.ok || !body)
      throw new Error(
        "Steam could not read the match history. Check the authentication code and sharing code.",
      );
    let payload: { result?: { nextcode?: string } };
    try {
      payload = JSON.parse(body) as { result?: { nextcode?: string } };
    } catch {
      throw new Error("Steam returned an invalid match history response.");
    }
    const next = payload.result?.nextcode;
    if (!next || next === "n/a" || codes.includes(next)) break;
    codes.push(next);
  }
  return codes;
}

export async function fetchMatchDetails(steamId: string, codes: string[]) {
  const refreshToken = process.env.STEAM_BOT_REFRESH_TOKEN;
  if (!refreshToken)
    throw new Error("STEAM_BOT_REFRESH_TOKEN is not configured.");

  const client = new SteamUserClient({ dataDirectory: null });
  const cs2 = new GlobalOffensive(client);
  let fatalError: Error | null = null;
  const rememberError = (error: Error) => {
    fatalError = error;
  };
  client.on("error", rememberError);
  cs2.on("error", rememberError);
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      client.removeListener("error", fail);
      cs2.removeListener("error", fail);
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error("Steam login timed out.")), 30_000);
    client.once("error", fail);
    cs2.once("error", fail);
    cs2.once("connectedToGC", () => {
      cleanup();
      resolve();
    });
    client.once("loggedOn", () => client.gamesPlayed([730]));
    client.logOn({ refreshToken });
  });

  try {
    const requestList = (request: () => void, label: string) =>
      new Promise<UnknownRecord[]>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          cs2.removeListener("matchList", onList);
          client.removeListener("error", onError);
          cs2.removeListener("error", onError);
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error(`Steam did not return ${label}.`));
        }, 20_000);
        const onList = (items: unknown[]) => {
          if (!Array.isArray(items)) return;
          cleanup();
          resolve(items.map(asRecord));
        };
        client.once("error", onError);
        cs2.once("error", onError);
        cs2.on("matchList", onList);
        try {
          request();
        } catch (error) {
          cleanup();
          reject(error);
        }
      });

    const matches = (
      await requestList(
        () => {
          if (cs2.requestRecentGames(steamId) === false)
            throw new Error("SteamID could not be used for recent matches.");
        },
        "recent matches",
      )
    ).map((match) => normalizeMatch(match, null, steamId));
    for (const code of codes) {
      if (fatalError) throw fatalError;
      const requested = await requestList(() => cs2.requestGame(code), `match ${code}`);
      const match = requested[0];
      if (match) matches.push(normalizeMatch(match, code, steamId));
    }
    const unique = [...new Map(matches.map((match) => [match.steamMatchId, match])).values()];
    for (const match of unique) {
      if (!match.map && match.demoUrl) match.map = await mapFromDemo(match.demoUrl);
    }
    return unique;
  } finally {
    client.logOff();
  }
}

function normalizeMatch(match: UnknownRecord, shareCode: string | null, steamId: string): ImportedSteamMatch {
  const rounds = Array.isArray(match.roundstatsall) ? match.roundstatsall : [];
  const finalRound = asRecord(rounds.at(-1));
  const firstRound = asRecord(rounds[0]);
  const reservation = asRecord(finalRound.reservation ?? firstRound.reservation);
  const watchable = asRecord(match.watchablematchinfo);
  const mapValues = rounds
    .map((round) => asRecord(round).map)
    .filter((value): value is string => typeof value === "string");
  if (typeof watchable.game_map === "string") mapValues.unshift(watchable.game_map);
  const mapName = mapValues.find((value) => /^(?:de|cs)_[a-z0-9_]+$/i.test(value));
  const demoUrl = mapValues.find((value) => /^https?:\/\/\S+\.dem\.bz2(?:\?.*)?$/i.test(value));
  const accountIds = numberArray(reservation.account_ids);
  const accountId = Number(BigInt(steamId) & 0xffffffffn);
  const playerIndex = accountIds.indexOf(accountId);
  const scores = numberArray(finalRound.team_scores);
  const teamIndex = playerIndex < 0 ? -1 : playerIndex < accountIds.length / 2 ? 0 : 1;
  const teamScore = teamIndex < 0 ? null : (scores[teamIndex] ?? null);
  const enemyScore = teamIndex < 0 ? null : (scores[teamIndex === 0 ? 1 : 0] ?? null);
  const kills = playerIndex < 0 ? null : (numberArray(finalRound.kills)[playerIndex] ?? null);
  const deaths = playerIndex < 0 ? null : (numberArray(finalRound.deaths)[playerIndex] ?? null);
  const assists = playerIndex < 0 ? null : (numberArray(finalRound.assists)[playerIndex] ?? null);
  const headshots = playerIndex < 0 ? null : (numberArray(finalRound.enemy_headshots)[playerIndex] ?? null);
  return {
    steamMatchId: idString(match.matchid),
    shareCode,
    playedAt: new Date(Number(match.matchtime) * 1000),
    map: mapName ? mapName.replace(/^(?:de|cs)_/i, "") : null,
    teamScore,
    enemyScore,
    kills,
    deaths,
    assists,
    headshot: kills && headshots != null ? (headshots / kills) * 100 : null,
    demoUrl: demoUrl ?? null,
    result: teamScore == null || enemyScore == null ? null : teamScore === enemyScore ? "DRAW" : teamScore > enemyScore ? "WIN" : "LOSS",
  };
}

async function mapFromDemo(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok || !response.body) return null;
    const source = Readable.fromWeb(response.body as never);
    const decoder = unbzip2Stream();
    const prefix = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let length = 0;
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        source.destroy();
        decoder.destroy();
        if (error) reject(error);
        else resolve(Buffer.concat(chunks, length));
      };
      decoder.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        length += chunk.length;
        if (length >= 2_000_000) finish();
      });
      decoder.once("end", () => finish());
      decoder.once("error", (error: Error) => finish(error));
      source.once("error", (error: Error) => finish(error));
      source.pipe(decoder);
    });
    const map = DemoReader.parseHeader(prefix)?.map_name;
    return map ? map.replace(/^(?:de|cs)_/i, "") : null;
  } catch {
    return null;
  }
}
