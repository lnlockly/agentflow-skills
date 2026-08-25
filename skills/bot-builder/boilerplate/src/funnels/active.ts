// The funnel the bot currently runs. This is the SINGLE switch point:
// `scripts/clone-build.mjs` overwrites this file to point at a generated funnel,
// so nothing else in bot.ts has to change. By default it's the example `welcome`.
export { welcome as activeFunnel } from "./welcome.js";
export const ACTIVE_NAME = "welcome";
