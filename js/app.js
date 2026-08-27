import { bindCommandUI, loadCommands } from './commands.js'

import { loadAccount } from './account.js'

import { loadRedemptions } from './redemptions.js'

import { loadGameQueue } from './gamequeue.js'

import { loadGameLibrary, loadCompletedGames } from './gamelibrary.js?v=20260827-1'

function hideSpecialViews () {
  const gameQueuePanel = document.getElementById('gameQueuePanel')

  const gameLibraryPanel = document.getElementById('gameLibraryPanel')

  const completedGamesPanel = document.getElementById('completedGamesPanel')

  if (gameQueuePanel) {
    gameQueuePanel.hidden = true
  }

  if (gameLibraryPanel) {
    gameLibraryPanel.hidden = true
  }

  if (completedGamesPanel) {
    completedGamesPanel.hidden = true
  }
}

function clearNavigation () {
  document.querySelectorAll('.nav-btn').forEach(button => {
    button.classList.remove('active')
  })
}

function scrollToMobileContent (element) {
  if (!element) {
    return
  }

  if (!window.matchMedia('(max-width: 900px)').matches) {
    return
  }

  requestAnimationFrame(() => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  })
}

function showCommandDatabase () {
  const searchPanel = document.getElementById('searchPanel')

  const commandPanel = document.getElementById('commandDatabasePanel')

  hideSpecialViews()

  if (searchPanel) {
    searchPanel.hidden = false
  }

  if (commandPanel) {
    commandPanel.hidden = false
  }

  clearNavigation()
}

function showGameQueue () {
  const searchPanel = document.getElementById('searchPanel')

  const commandPanel = document.getElementById('commandDatabasePanel')

  const gameQueuePanel = document.getElementById('gameQueuePanel')

  const gameQueueBtn = document.getElementById('gameQueueBtn')

  if (searchPanel) {
    searchPanel.hidden = true
  }

  if (commandPanel) {
    commandPanel.hidden = true
  }

  hideSpecialViews()
  clearNavigation()

  if (gameQueuePanel) {
    gameQueuePanel.hidden = false
  }

  if (gameQueueBtn) {
    gameQueueBtn.classList.add('active')
  }

  loadGameQueue()

  scrollToMobileContent(gameQueuePanel)
}

function showGameLibrary () {
  const searchPanel = document.getElementById('searchPanel')

  const commandPanel = document.getElementById('commandDatabasePanel')

  const gameLibraryPanel = document.getElementById('gameLibraryPanel')

  const gameLibraryBtn = document.getElementById('gameLibraryBtn')

  if (searchPanel) {
    searchPanel.hidden = true
  }

  if (commandPanel) {
    commandPanel.hidden = true
  }

  hideSpecialViews()
  clearNavigation()

  if (gameLibraryPanel) {
    gameLibraryPanel.hidden = false
  }

  if (gameLibraryBtn) {
    gameLibraryBtn.classList.add('active')
  }

  loadGameLibrary()

  scrollToMobileContent(gameLibraryPanel)
}

function showCompletedGames () {
  const searchPanel = document.getElementById('searchPanel')

  const commandPanel = document.getElementById('commandDatabasePanel')

  const completedGamesPanel = document.getElementById('completedGamesPanel')

  const completedGamesBtn = document.getElementById('completedGamesBtn')

  if (searchPanel) {
    searchPanel.hidden = true
  }

  if (commandPanel) {
    commandPanel.hidden = true
  }

  hideSpecialViews()
  clearNavigation()

  if (completedGamesPanel) {
    completedGamesPanel.hidden = false
  }

  if (completedGamesBtn) {
    completedGamesBtn.classList.add('active')
  }

  loadCompletedGames()

  scrollToMobileContent(completedGamesPanel)
}

function bindViewSwitching () {
  const gameQueueBtn = document.getElementById('gameQueueBtn')

  const gameLibraryBtn = document.getElementById('gameLibraryBtn')

  const completedGamesBtn = document.getElementById('completedGamesBtn')

  const filterButtons = document.querySelectorAll('.nav-btn[data-filter]')

  if (gameQueueBtn) {
    gameQueueBtn.addEventListener('click', showGameQueue)
  }

  if (gameLibraryBtn) {
    gameLibraryBtn.addEventListener('click', showGameLibrary)
  }

  if (completedGamesBtn) {
    completedGamesBtn.addEventListener('click', showCompletedGames)
  }

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      showCommandDatabase()

      button.classList.add('active')

      const searchPanel = document.getElementById('searchPanel')

      scrollToMobileContent(searchPanel)
    })
  })
}

async function startOxnet () {
  bindCommandUI()
  bindViewSwitching()

  await loadCommands()
  await loadRedemptions()
  await loadAccount()
}

startOxnet()
