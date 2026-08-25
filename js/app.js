import {
  bindCommandUI,
  loadCommands
} from "./commands.js";

import {
  loadAccount
} from "./account.js";

async function startOxnet() {
  bindCommandUI();

  await loadCommands();
  await loadAccount();
}

startOxnet();
