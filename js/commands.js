import { API_URL } from './config.js'

let allCommands = []
let currentFilter = null
let copyBindingInstalled = false
let uiBound = false

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

function isVisibleCommand (cmd) {
  return normalize(cmd.status) !== 'planned'
}

function matchesCategory (cmd, filter) {
  if (!isVisibleCommand(cmd)) {
    return false
  }

  if (filter === 'all') {
    return true
  }

  if (filter === 'utility') {
    const category =
      normalize(cmd.category)

    return (
      category === 'social' ||
      category === 'schmeckles'
    )
  }

  if (filter === 'redemption') {
    return (
      normalize(cmd.category) === 'redemption' ||
      normalize(cmd.source) === 'neon-redemption' ||
      Boolean(cmd.redemption_key)
    )
  }

  if (filter === 'sfx') {
    return (
      normalize(cmd.category) === 'sfx'
    )
  }

  return false
}

function getCategoryCount (filter) {
  return allCommands.filter(
    cmd => matchesCategory(cmd, filter)
  ).length
}

function getCopyCommand (cmd) {
  if (
    normalize(cmd.status) !== 'available'
  ) {
    return ''
  }

  const example =
    String(cmd.example || '').trim()

  const command =
    String(cmd.command || '').trim()

  if (example.startsWith('!')) {
    return example
  }

  if (command.startsWith('!')) {
    return command
  }

  return ''
}

async function copyCommand (
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
      if (
        document.body.contains(button)
      ) {
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

function hideSearch () {
  const panel =
    document.getElementById(
      'searchPanel'
    )

  if (panel) {
    panel.hidden = true
  }
}

function showSearch () {
  const panel =
    document.getElementById(
      'searchPanel'
    )

  if (panel) {
    panel.hidden = false
  }
}

export function showCommandDirectory () {
  const container =
    document.getElementById(
      'commandsContainer'
    )

  const search =
    document.getElementById(
      'searchInput'
    )

  if (!container) {
    return
  }

  currentFilter = null

  if (search) {
    search.value = ''
  }

  hideSearch()

  const categories = [
    {
      key: 'all',
      name: 'ALL COMMANDS',
      description:
        'Every currently available OXNET command.'
    },
    {
      key: 'utility',
      name: 'UTILITY',
      description:
        'Account, Schmeckles and general chat commands.'
    },
    {
      key: 'redemption',
      name: 'REDEMPTIONS',
      description:
        'Viewer redemptions and interactive stream controls.'
    },
    {
      key: 'sfx',
      name: 'SFX',
      description:
        'Free sound effect commands. Use irresponsibly.'
    }
  ]

  container.innerHTML = `
    <div
      class="status-box"
      style="
        margin: 0 0 12px;
        min-height: 0;
      "
    >
      SELECT COMMAND DATABASE
    </div>

    <div
      style="
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(190px, 1fr)
          );
        gap: 8px;
      "
    >
      ${categories
        .map(category => `
          <button
            type="button"
            class="find-btn"
            data-command-category="${category.key}"
            style="
              min-height: 105px;
              padding: 10px;
              text-align: left;
              font-family:
                'Courier New',
                monospace;
            "
          >
            <strong>
              ${escapeHtml(category.name)}
            </strong>

            <br><br>

            ${escapeHtml(
              category.description
            )}

            <br><br>

            [
            ${getCategoryCount(
              category.key
            ).toLocaleString()}
            ]
          </button>
        `)
        .join('')}
    </div>
  `
}

function getCategoryTitle () {
  const labels = {
    all: 'ALL COMMANDS',
    utility: 'UTILITY',
    redemption: 'REDEMPTIONS',
    sfx: 'SFX'
  }

  return (
    labels[currentFilter] ||
    'COMMANDS'
  )
}

export function renderCommands () {
  if (!currentFilter) {
    showCommandDirectory()
    return
  }

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

  showSearch()

  const query =
    normalize(searchInput.value)

  const filtered = allCommands
    .filter(cmd => {
      if (
        !matchesCategory(
          cmd,
          currentFilter
        )
      ) {
        return false
      }

      const haystack = [
        cmd.name,
        cmd.command,
        cmd.category,
        cmd.kind,
        cmd.description,
        cmd.example,
        cmd.cooldown
      ]
        .join(' ')
        .toLowerCase()

      return (
        !query ||
        haystack.includes(query)
      )
    })
    .sort((a, b) => {
      const aName =
        String(
          a.name ||
          a.command ||
          ''
        )

      const bName =
        String(
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

  const commandCards =
    filtered.length
      ? filtered
          .map(cmd => {
            const kind =
              kindLabel(cmd.kind)

            const displayName =
              cmd.name ||
              cmd.command ||
              'UNKNOWN'

            const copyText =
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
                    ${escapeHtml(
                      displayName
                    )}
                  </div>

                  <span
                    class="badge status"
                  >
                    ${categoryLabel(
                      cmd.category
                    )}
                  </span>

                  ${
                    kind
                      ? `
                        <span
                          class="badge kind"
                        >
                          ${escapeHtml(
                            kind
                          )}
                        </span>
                      `
                      : ''
                  }

                  ${
                    normalize(
                      cmd.category
                    ) === 'sfx'
                      ? `
                        <span
                          class="badge cost"
                        >
                          FREE
                        </span>
                      `
                      : Number(
                            cmd.cost || 0
                          ) > 0
                        ? `
                          <span
                            class="badge cost"
                          >
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
                    ) !==
                      'coming soon'
                      ? `
                        <span
                          class="
                            badge
                            cooldown
                          "
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
                        <span
                          class="badge new"
                        >
                          NEW
                        </span>
                      `
                      : ''
                  }

                </div>

                <div
                  class="command-desc"
                >
                  ${escapeHtml(
                    cmd.description ||
                    ''
                  )}
                </div>

                ${
                  cmd.example
                    ? `
                      <div
                        class="
                          command-example
                        "
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
                  copyText || hasAction
                    ? `
                      <div
                        style="
                          display: flex;
                          flex-wrap: wrap;
                          gap: 6px;
                          margin-top: 9px;
                        "
                      >

                        ${
                          copyText
                            ? `
                              <button
                                type="button"
                                class="find-btn"
                                data-copy-command="${escapeHtml(
                                  copyText
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
                                type="button"
                                class="find-btn"
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
      : `
          <div class="empty">
            *** NO MATCHING COMMANDS FOUND.
          </div>
        `

  container.innerHTML = `
    <div
      style="
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 10px;
      "
    >
      <button
        type="button"
        class="find-btn"
        data-command-back
      >
        &lt; COMMANDS
      </button>

      <div
        class="status-box"
        style="
          margin: 0;
          min-height: 0;
          flex: 1;
        "
      >
        ${escapeHtml(
          getCategoryTitle()
        )}
        //
        ${filtered.length.toLocaleString()}
        RESULTS
      </div>
    </div>

    ${commandCards}
  `
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

  if (currentFilter) {
    renderCommands()
  } else {
    showCommandDirectory()
  }
}

export function bindCommandUI () {
  if (uiBound) {
    return
  }

  uiBound = true

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
      () => {
        if (currentFilter) {
          renderCommands()
        }
      }
    )
  }

  if (findBtn) {
    findBtn.addEventListener(
      'click',
      () => {
        if (currentFilter) {
          renderCommands()
        }
      }
    )
  }

  if (!copyBindingInstalled) {
    copyBindingInstalled = true

    document.addEventListener(
      'click',
      event => {
        const category =
          event.target.closest(
            '[data-command-category]'
          )

        if (category) {
          currentFilter =
            category.dataset
              .commandCategory

          if (searchInput) {
            searchInput.value = ''
          }

          renderCommands()
          return
        }

        const back =
          event.target.closest(
            '[data-command-back]'
          )

        if (back) {
          showCommandDirectory()
          return
        }

        const copy =
          event.target.closest(
            '[data-copy-command]'
          )

        if (copy) {
          copyCommand(
            copy.dataset.copyCommand,
            copy
          )
        }
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

async function loadStaticFallback () {
  const response =
    await fetch(
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
    const response =
      await fetch(
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
      !Array.isArray(
        data.commands
      )
    ) {
      throw new Error(
        'Command API returned invalid data'
      )
    }

    allCommands =
      data.commands

    updateStatus()
    showCommandDirectory()

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
      await loadStaticFallback()

    updateStatus()
    showCommandDirectory()

    const statusBox =
      document.getElementById(
        'statusBox'
      )

    if (statusBox) {
      statusBox.innerHTML += `
        <br>
        COMMAND SOURCE:
        STATIC FALLBACK
      `
    }
  } catch (fallbackError) {
    console.error(
      'OXNET command database and fallback failed.',
      {
        backendError,
        fallbackError
      }
    )

    allCommands = []

    const container =
      document.getElementById(
        'commandsContainer'
      )

    if (container) {
      container.innerHTML = `
        <div class="empty">
          *** COMMAND DATABASE FAILED TO LOAD.
        </div>
      `
    }
  }
}
