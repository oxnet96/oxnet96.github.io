import { bindCommandUI, loadCommands } from "./commands.js";

import { loadAccount } from "./account.js";

import { loadRedemptions } from "./redemptions.js";

import { loadGameQueue } from "./gamequeue.js";

import { loadGameLibrary } from "./gamelibrary.js";

function hideSpecialViews() {
  const gameQueuePanel = document.getElementById("gameQueuePanel");

  const gameLibraryPanel = document.getElementById("gameLibraryPanel");

  if (gameQueuePanel) {
    gameQueuePanel.hidden = true;
  }

  if (gameLibraryPanel) {
    gameLibraryPanel.hidden = true;
  }
}

function clearNavigation() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.remove("active");
  });
}

function showCommandDatabase() {
  const searchPanel = document.getElementById("searchPanel");

  const commandPanel = document.getElementById("commandDatabasePanel");

  hideSpecialViews();

  if (searchPanel) {
    searchPanel.hidden = false;
  }

  if (commandPanel) {
    commandPanel.hidden = false;
  }

  clearNavigation();
}

function showGameQueue() {
  const searchPanel = document.getElementById("searchPanel");

  const commandPanel = document.getElementById("commandDatabasePanel");

  const gameQueuePanel = document.getElementById("gameQueuePanel");

  const gameQueueBtn = document.getElementById("gameQueueBtn");

  if (searchPanel) {
    searchPanel.hidden = true;
  }

  if (commandPanel) {
    commandPanel.hidden = true;
  }

  hideSpecialViews();
  clearNavigation();

  if (gameQueuePanel) {
    gameQueuePanel.hidden = false;
  }

  if (gameQueueBtn) {
    gameQueueBtn.classList.add("active");
  }

  loadGameQueue();
}

function showGameLibrary() {
  const searchPanel = document.getElementById("searchPanel");

  const commandPanel = document.getElementById("commandDatabasePanel");

  const gameLibraryPanel = document.getElementById("gameLibraryPanel");

  const gameLibraryBtn = document.getElementById("gameLibraryBtn");

  if (searchPanel) {
    searchPanel.hidden = true;
  }

  if (commandPanel) {
    commandPanel.hidden = true;
  }

  hideSpecialViews();
  clearNavigation();

  if (gameLibraryPanel) {
    gameLibraryPanel.hidden = false;
  }

  if (gameLibraryBtn) {
    gameLibraryBtn.classList.add("active");
  }

  loadGameLibrary();
}

function bindViewSwitching() {
  const gameQueueBtn = document.getElementById("gameQueueBtn");

  const gameLibraryBtn = document.getElementById("gameLibraryBtn");

  const filterButtons = document.querySelectorAll(".nav-btn[data-filter]");

  if (gameQueueBtn) {
    gameQueueBtn.addEventListener("click", showGameQueue);
  }

  if (gameLibraryBtn) {
    gameLibraryBtn.addEventListener("click", showGameLibrary);
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showCommandDatabase();

      button.classList.add("active");
    });
  });
}

async function startOxnet() {
  bindCommandUI();
  bindViewSwitching();

  await loadCommands();
  await loadRedemptions();
  await loadAccount();
}

startOxnet();
