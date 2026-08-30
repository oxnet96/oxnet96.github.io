import {
  bindCommandUI,
  loadCommands,
  showCommandDirectory
} from './commands.js?v=20260830-141616'

import { loadAccount } from './account.js'

import {
  loadRedemptions
} from './redemptions.js?v=20260830-141616'

import {
  loadGameQueue
} from './gamequeue.js'

import {
  loadGameLibrary,
  loadCompletedGames
} from './gamelibrary.js'

function hideSpecialViews () {
  const ids = [
    'gameQueuePanel',
    'gameLibraryPanel',
    'completedGamesPanel'
  ]

  ids.forEach(id => {
    const panel =
      document.getElementById(id)

    if (panel) {
      panel.hidden = true
    }
  })
}

function clearNavigation () {
  document
    .querySelectorAll('.nav-btn')
    .forEach(button => {
      button.classList.remove(
        'active'
      )
    })
}

function scrollToMobileContent (
  element
) {
  if (!element) {
    return
  }

  if (
    !window.matchMedia(
      '(max-width: 900px)'
    ).matches
  ) {
    return
  }

  requestAnimationFrame(() => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  })
}

function showCommands () {
  const searchPanel =
    document.getElementById(
      'searchPanel'
    )

  const commandPanel =
    document.getElementById(
      'commandDatabasePanel'
    )

  const commandsBtn =
    document.getElementById(
      'commandsBtn'
    )

  hideSpecialViews()

  if (searchPanel) {
    searchPanel.hidden = true
  }

  if (commandPanel) {
    commandPanel.hidden = false
  }

  clearNavigation()

  if (commandsBtn) {
    commandsBtn.classList.add(
      'active'
    )
  }

  showCommandDirectory()

  scrollToMobileContent(
    commandPanel
  )
}

function showGameQueue () {
  const searchPanel =
    document.getElementById(
      'searchPanel'
    )

  const commandPanel =
    document.getElementById(
      'commandDatabasePanel'
    )

  const panel =
    document.getElementById(
      'gameQueuePanel'
    )

  if (searchPanel) {
    searchPanel.hidden = true
  }

  if (commandPanel) {
    commandPanel.hidden = true
  }

  hideSpecialViews()
  clearNavigation()

  if (panel) {
    panel.hidden = false
  }

  document
    .getElementById(
      'gameQueueBtn'
    )
    ?.classList.add('active')

  loadGameQueue()

  scrollToMobileContent(panel)
}

function showGameLibrary () {
  const searchPanel =
    document.getElementById(
      'searchPanel'
    )

  const commandPanel =
    document.getElementById(
      'commandDatabasePanel'
    )

  const panel =
    document.getElementById(
      'gameLibraryPanel'
    )

  if (searchPanel) {
    searchPanel.hidden = true
  }

  if (commandPanel) {
    commandPanel.hidden = true
  }

  hideSpecialViews()
  clearNavigation()

  if (panel) {
    panel.hidden = false
  }

  document
    .getElementById(
      'gameLibraryBtn'
    )
    ?.classList.add('active')

  loadGameLibrary()

  scrollToMobileContent(panel)
}

function showCompletedGames () {
  const searchPanel =
    document.getElementById(
      'searchPanel'
    )

  const commandPanel =
    document.getElementById(
      'commandDatabasePanel'
    )

  const panel =
    document.getElementById(
      'completedGamesPanel'
    )

  if (searchPanel) {
    searchPanel.hidden = true
  }

  if (commandPanel) {
    commandPanel.hidden = true
  }

  hideSpecialViews()
  clearNavigation()

  if (panel) {
    panel.hidden = false
  }

  document
    .getElementById(
      'completedGamesBtn'
    )
    ?.classList.add('active')

  loadCompletedGames()

  scrollToMobileContent(panel)
}

function bindViewSwitching () {
  document
    .getElementById(
      'commandsBtn'
    )
    ?.addEventListener(
      'click',
      showCommands
    )

  document
    .getElementById(
      'gameQueueBtn'
    )
    ?.addEventListener(
      'click',
      showGameQueue
    )

  document
    .getElementById(
      'gameLibraryBtn'
    )
    ?.addEventListener(
      'click',
      showGameLibrary
    )

  document
    .getElementById(
      'completedGamesBtn'
    )
    ?.addEventListener(
      'click',
      showCompletedGames
    )
}

async function startOxnet () {
  bindCommandUI()
  bindViewSwitching()

  await loadCommands()
  await loadRedemptions()
  await loadAccount()

  showCommands()
}

startOxnet()
