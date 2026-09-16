declare module "globaloffensive" {
  import SteamUser from "steam-user";
  import { EventEmitter } from "node:events";
  export default class GlobalOffensive extends EventEmitter {
    constructor(client: SteamUser);
    requestGame(shareCode: string): void;
    requestRecentGames(steamId: string): false | void;
  }
}
