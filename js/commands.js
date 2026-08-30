import { API_URL } from './config.js'

let allCommands = []
let currentFilter = 'all'
let copyBindingInstalled = false

export function normalize (value) {
  return String(value || '')
    .toLowerCase()
    .trim()
}

export function escapeHtml (value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function categoryLabel (category) {
  const labels = {
    social: 'UTILITY',
    schmeckles: 'UTILITY',
    sfx: 'SFX',
    redemption: 'REDEMPTION'
  }

  return (
    labels[normalize(category)] ||
    String(category || '').toUpperCase()
  )
}

function kindLabel (kind) {
  const labels = {
    chat: 'CHAT',
    'chat-redemption': 'TWITCH CHAT',
    'channel-point': 'CHANNEL POINT',
    portal: 'OXNET PORTAL'
  }

  return labels[normalize(kind)] || ''
}

function getCopyCommand (cmd) {
  if (
    normalize(cmd.status) !== 'available'
  ) {
    return ''
  }

  const example = String(
    cmd.example || ''
  ).trim()

  const command = String(
    cmd.command || ''
  ).trim()

  /*
    Prefer the useful example:
      !gamble all
      !so @streamer
      !addgame G####

    Fall back to the command itself.
  */

  if (example.startsWith('!')) {
    return example
  }

  if (command.startsWith('!')) {
    return command
  }

  return ''
}

async function copyCommandToClipboard (
  text,
  button
) {
  if (!text) {
    return
  }

  const original =
    button.textContent.trim()

  try {
    await navigator.clipboard.writeText(
      text
    )

    button.textContent = 'COPIED!'

    setTimeout(() => {
      if (document.body.contains(button)) {
        button.textContent = original
      }
    }, 1200)
  } catch (error) {
    console.error(
      'Clipboard failed.',
      error
    )

    window.prompt(
      'COPY THIS COMMAND:',
      text
    )
  }
}

export function getCommandStats () {
  return {
    publicChatCommands:
      allCommands.filter(
        item =>
          normalize(item.status) ===
            'available' &&
          normalize(item.kind) ===
            'chat'
      ).length,

    sfxCommands:
      allCommands.filter(
        item =>
          normalize(item.category) ===
            'sfx' &&
          normalize(item.status) ===
            'available'
      ).length
  }
}

export function renderCommands () {
  const container =
    document.getElementById(
      'commandsContainer'
    )

  const searchInput =
    document.getElementById(
      'searchInput'
    )

  if (!container || !searchInput) {
    return
  }

  const query =
    normalize(searchInput.value)

  const filtered = allCommands
    .filter(cmd => {
      /*
        Coming-soon/planned entries are no longer
        part of the viewer-facing portal.
      */

      if (
        normalize(cmd.status) === 'planned'
      ) {
        return false
      }

      let matchesFilter = false

      if (currentFilter === 'all') {
        matchesFilter = true
      } else if (
        currentFilter === 'utility'
      ) {
        const category =
          normalize(cmd.category)

        matchesFilter =
          category === 'social' ||
          category === 'schmeckles'
      } else if (
        currentFilter === 'redemption'
      ) {
        matchesFilter =
          normalize(cmd.category) ===
            'redemption' ||
          normalize(cmd.source) ===
            'neon-redemption' ||
          Boolean(cmd.redemption_key)
      } else {
        matchesFilter =
          normalize(cmd.category) ===
          currentFilter
      }

      const haystack = [
        cmd.name,
        cmd.command,
        cmd.category,
        cmd.kind,
        cmd.description,
        cmd.example,
        cmd.status,
        cmd.cooldown
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        !query ||
        haystack.includes(query)

      return (
        matchesFilter &&
        matchesSearch
      )
    })
    .sort((a, b) => {
      const aName = String(
        a.name ||
        a.command ||
        ''
      )

      const bName = String(
        b.name ||
        b.command ||
        ''
      )

      return aName.localeCompare(
        bName,
        undefined,
        {
          sensitivity: 'base'
        }
      )
    })

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty">
        *** NO MATCHES FOUND. TRY AGAIN, GENIUS.
      </div>
    `

    return
  }

  container.innerHTML =
    filtered
      .map(cmd => {
        const kind =
          kindLabel(cmd.kind)

        const displayName =
          cmd.name ||
          cmd.command ||
          'UNKNOWN'

        const copyCommand =
          getCopyCommand(cmd)

        const hasAction =
          Boolean(
            cmd.action &&
            cmd.action_label
          )

        return `
          <div class="command-card">

            <div class="command-title">

              <div class="command-name">
                ${escapeHtml(displayName)}
              </div>

              <span class="badge status">
                ${categoryLabel(
                  cmd.category
                )}
              </span>

              ${
                kind
                  ? `
                    <span class="badge kind">
                      ${escapeHtml(kind)}
                    </span>
                  `
                  : ''
              }

              ${
                normalize(
                  cmd.category
                ) === 'sfx'
                  ? `
                    <span class="badge cost">
                      FREE
                    </span>
                  `
                  : Number(
                        cmd.cost || 0
                      ) > 0
                    ? `
                      <span class="badge cost">
                        ${Number(
                          cmd.cost
                        ).toLocaleString()}
                        SCHMECKLES
                      </span>
                    `
                    : ''
              }

              ${
                cmd.cooldown &&
                normalize(
                  cmd.cooldown
                ) !== 'coming soon'
                  ? `
                    <span
                      class="badge cooldown"
                    >
                      ${escapeHtml(
                        cmd.cooldown
                      )}
                    </span>
                  `
                  : ''
              }

              ${
                cmd.isNew
                  ? `
                    <span class="badge new">
                      NEW
                    </span>
                  `
                  : ''
              }

            </div>

            <div class="command-desc">
              ${escapeHtml(
                cmd.description || ''
              )}
            </div>

            ${
              cmd.example
                ? `
                  <div
                    class="command-example"
                  >
                    &gt;
                    ${escapeHtml(
                      cmd.example
                    )}
                  </div>
                `
                : ''
            }

            ${
              copyCommand || hasAction
                ? `
                  <div
                    style="
                      margin-top: 9px;
                      display: flex;
                      flex-wrap: wrap;
                      gap: 6px;
                      justify-content:
                        flex-start;
                    "
                  >

                    ${
                      copyCommand
                        ? `
                          <button
                            class="find-btn"
                            type="button"
                            data-copy-command="${escapeHtml(
                              copyCommand
                            )}"
                          >
                            COPY COMMAND
                          </button>
                        `
                        : ''
                    }

                    ${
                      hasAction
                        ? `
                          <button
                            class="find-btn"
                            type="button"
                            data-command-action="${escapeHtml(
                              cmd.action
                            )}"
                            data-redemption-key="${escapeHtml(
                              cmd.redemption_key ||
                              ''
                            )}"
                          >
                            ${escapeHtml(
                              cmd.action_label
                            )}
                          </button>
                        `
                        : ''
                    }

                  </div>
                `
                : ''
            }

          </div>
        `
      })
      .join('')
}

export function mergeCommands (
  items = []
) {
  if (!Array.isArray(items)) {
    return
  }

  allCommands = [
    ...allCommands.filter(
      item =>
        normalize(item.source) !==
        'neon-redemption'
    ),
    ...items
  ]

  updateStatus()
  renderCommands()
}

export function bindCommandUI () {
  const buttons =
    document.querySelectorAll(
      '.nav-btn[data-filter]'
    )

  buttons.forEach(btn => {
    btn.addEventListener(
      'click',
      () => {
        buttons.forEach(
          button =>
            button.classList.remove(
              'active'
            )
        )

        btn.classList.add('active')

        currentFilter =
          btn.dataset.filter

        renderCommands()
      }
    )
  })

  const searchInput =
    document.getElementById(
      'searchInput'
    )

  const findBtn =
    document.getElementById(
      'findBtn'
    )

  if (searchInput) {
    searchInput.addEventListener(
      'input',
      renderCommands
    )
  }

  if (findBtn) {
    findBtn.addEventListener(
      'click',
      renderCommands
    )
  }

  /*
    Delegated binding survives every command
    list re-render.
  */

  if (!copyBindingInstalled) {
    copyBindingInstalled = true

    document.addEventListener(
      'click',
      event => {
        const button =
          event.target.closest(
            '[data-copy-command]'
          )

        if (!button) {
          return
        }

        copyCommandToClipboard(
          button.dataset.copyCommand,
          button
        )
      }
    )
  }
}

export function updateStatus () {
  const {
    publicChatCommands,
    sfxCommands
  } = getCommandStats()

  const statusBox =
    document.getElementById(
      'statusBox'
    )

  if (!statusBox) {
    return
  }

  statusBox.innerHTML = `
    CONNECTED TO OXNET_96<br>
    ECONOMY: SCHMECKLES<br>
    PUBLIC CHAT CMDS:
    ${publicChatCommands}<br>
    SFX COMMANDS:
    ${sfxCommands}<br>
    REDEEM: TWITCH CHAT<br>
    WATCH RATE: +1 / LIVE MIN<br>
    SFX RATE: FREE<br>
    CLOCK IN: +100 / STREAM<br>
    FIRST CLAIM: +500<br>
    <br>
    BACKEND: CONNECTING
  `
}

async function loadStaticCommandFallback () {
  const response = await fetch(
    './commands.json',
    {
      cache: 'no-store'
    }
  )

  if (!response.ok) {
    throw new Error(
      `Static command fallback returned ${response.status}`
    )
  }

  const data =
    await response.json()

  if (!Array.isArray(data)) {
    throw new Error(
      'Static command fallback returned invalid data'
    )
  }

  return data
}

export async function loadCommands () {
  let backendError = null

  try {
    const response = await fetch(
      `${API_URL}/commands`,
      {
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      throw new Error(
        `Command API returned ${response.status}`
      )
    }

    const data =
      await response.json()

    if (
      !Array.isArray(data.commands)
    ) {
      throw new Error(
        'Command API returned invalid data'
      )
    }

    allCommands = data.commands

    updateStatus()
    renderCommands()

    return
  } catch (error) {
    backendError = error

    console.error(
      'OXNET live command database failed. Trying static fallback.',
      error
    )
  }

  try {
    allCommands =
      await loadStaticCommandFallback()

    updateStatus()
    renderCommands()

    const statusBox =
      document.getElementById(
        'statusBox'
      )

    if (statusBox) {
      statusBox.innerHTML += `
        <br>
        COMMAND SOURCE: STATIC FALLBACK
      `
    }
  } catch (fallbackError) {
    console.error(
      'OXNET command database and static fallback both failed.',
      {
        backendError,
        fallbackError
      }
    )

    allCommands = []

    const statusBox =
      document.getElementById(
        'statusBox'
      )

    const container =
      document.getElementById(
        'commandsContainer'
      )

    if (statusBox) {
      statusBox.innerHTML = `
        CONNECTED TO OXNET_96<br>
        COMMAND DATABASE:
        UNAVAILABLE<br>
        <br>
        BACKEND: DEGRADED
      `
    }

    if (container) {
      container.innerHTML = `
        <div class="empty">
          *** COMMAND DATABASE FAILED TO LOAD.
        </div>
      `
    }
  }
}
