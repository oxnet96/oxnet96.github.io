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

import {
  loadGameQueue
} from "./gamequeue.js";


function showCommandDatabase() {
  const searchPanel =
    document.getElementById(
      "searchPanel"
    );

  const commandPanel =
    document.getElementById(
      "commandDatabasePanel"
    );

  const gameQueuePanel =
    document.getElementById(
      "gameQueuePanel"
    );

  const gameQueueBtn =
    document.getElementById(
      "gameQueueBtn"
    );

  if (searchPanel) {
    searchPanel.hidden = false;
  }

  if (commandPanel) {
    commandPanel.hidden = false;
  }

  if (gameQueuePanel) {
    gameQueuePanel.hidden = true;
  }

  if (gameQueueBtn) {
    gameQueueBtn.classList.remove(
      "active"
    );
  }
}


function showGameQueue() {
  const searchPanel =
    document.getElementById(
      "searchPanel"
    );

  const commandPanel =
    document.getElementById(
      "commandDatabasePanel"
    );

  const gameQueuePanel =
    document.getElementById(
      "gameQueuePanel"
    );

  const gameQueueBtn =
    document.getElementById(
      "gameQueueBtn"
    );

  const filterButtons =
    document.querySelectorAll(
      ".nav-btn[data-filter]"
    );

  if (searchPanel) {
    searchPanel.hidden = true;
  }

  if (commandPanel) {
    commandPanel.hidden = true;
  }

  if (gameQueuePanel) {
    gameQueuePanel.hidden = false;
  }

  filterButtons.forEach(
    button =>
      button.classList.remove(
        "active"
      )
  );

  if (gameQueueBtn) {
    gameQueueBtn.classList.add(
      "active"
    );
  }

  loadGameQueue();
}


function bindViewSwitching() {
  const gameQueueBtn =
    document.getElementById(
      "gameQueueBtn"
    );

  const filterButtons =
    document.querySelectorAll(
      ".nav-btn[data-filter]"
    );

  if (gameQueueBtn) {
    gameQueueBtn.addEventListener(
      "click",
      showGameQueue
    );
  }

  filterButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        showCommandDatabase
      );
    }
  );
}


async function startOxnet() {
  bindCommandUI();
  bindViewSwitching();

  await loadCommands();
  await loadRedemptions();
  await loadAccount();
}

startOxnet();