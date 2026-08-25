import {
  bindCommandUI,
  loadCommands
} from "./commands.js";

import {
  loadAccount
} from "./account.js";

import {
  loadRedemptions
} from "./redemptions.js";

async function startOxnet() {
  bindCommandUI();

  // Load the static command database first, then merge the
  // live Neon redemption catalog into the same UI.
  await loadCommands();
  await loadRedemptions();

  // Account status runs last so the status panel reflects
  // the final command/redemption counts.
  await loadAccount();
}

startOxnet();
