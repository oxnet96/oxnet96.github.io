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

  await Promise.all([
    loadCommands(),
    loadRedemptions()
  ]);

  await loadAccount();
}

startOxnet();