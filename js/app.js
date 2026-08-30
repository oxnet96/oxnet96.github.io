import {
  bindCommandUI,
  loadCommands,
  showCommandDirectory
} from './commands.js?v=20260830-150831'

import {
  loadAccount
} from './account.js'

import {
  loadRedemptions,
  showRedemptionDirectory
} from './redemptions.js?v=20260830-151626'

import {
  loadGameQueue
} from './gamequeue.js'

import {
  loadGameLibrary,
  loadCompletedGames
} from './gamelibrary.js'


function hideSpecialViews () {
  const ids = [
    'redemptionsPanel',
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


function hideCommandUi () {
  const searchPanel =
    document.getElementById(
      'searchPanel'
    )

  const commandPanel =
    document.getElementById(
      'commandDatabasePanel'
    )

  if (searchPanel) {
    searchPanel.hidden = true
  }

  if (commandPanel) {
    commandPanel.hidden = true
  }
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

  hideSpecialViews()

  if (searchPanel) {
    searchPanel.hidden = true
  }

  if (commandPanel) {
    commandPanel.hidden = false
  }

  clearNavigation()

  document
    .getElementById(
      'commandsBtn'
    )
    ?.classList.add(
      'active'
    )

  showCommandDirectory()

  scrollToMobileContent(
    commandPanel
  )
}


function showRedemptions () {
  hideCommandUi()
  hideSpecialViews()
  clearNavigation()

  const panel =
    document.getElementById(
      'redemptionsPanel'
    )

  if (panel) {
    panel.hidden = false
  }

  document
    .getElementById(
      'redemptionsBtn'
    )
    ?.classList.add(
      'active'
    )

  showRedemptionDirectory()

  scrollToMobileContent(
    panel
  )
}


function showGameQueue () {
  hideCommandUi()
  hideSpecialViews()
  clearNavigation()

  const panel =
    document.getElementById(
      'gameQueuePanel'
    )

  if (panel) {
    panel.hidden = false
  }

  document
    .getElementById(
      'gameQueueBtn'
    )
    ?.classList.add(
      'active'
    )

  loadGameQueue()

  scrollToMobileContent(
    panel
  )
}


function showGameLibrary () {
  hideCommandUi()
  hideSpecialViews()
  clearNavigation()

  const panel =
    document.getElementById(
      'gameLibraryPanel'
    )

  if (panel) {
    panel.hidden = false
  }

  document
    .getElementById(
      'gameLibraryBtn'
    )
    ?.classList.add(
      'active'
    )

  loadGameLibrary()

  scrollToMobileContent(
    panel
  )
}


function showCompletedGames () {
  hideCommandUi()
  hideSpecialViews()
  clearNavigation()

  const panel =
    document.getElementById(
      'completedGamesPanel'
    )

  if (panel) {
    panel.hidden = false
  }

  document
    .getElementById(
      'completedGamesBtn'
    )
    ?.classList.add(
      'active'
    )

  loadCompletedGames()

  scrollToMobileContent(
    panel
  )
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
      'redemptionsBtn'
    )
    ?.addEventListener(
      'click',
      showRedemptions
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
