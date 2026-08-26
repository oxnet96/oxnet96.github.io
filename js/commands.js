let allCommands = []
let currentFilter = 'all'

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
    schmeckles: 'SCHMECKLES',
    sfx: 'SFX',
    redemption: 'REDEMPTION'
  }

  return labels[normalize(category)] || String(category || '').toUpperCase()
}

function kindLabel (kind) {
  const labels = {
    chat: 'CHAT',
    'chat-redemption': 'TWITCH CHAT',
    'channel-point': 'CHANNEL POINT',
    portal: 'OXNET PORTAL',
    planned: 'SYSTEM'
  }

  return labels[normalize(kind)] || ''
}

export function getCommandStats () {
  return {
    publicChatCommands: allCommands.filter(
      item =>
        normalize(item.status) === 'available' &&
        normalize(item.kind) === 'chat'
    ).length,

    paidSfx: allCommands.filter(
      item =>
        normalize(item.category) === 'sfx' &&
        normalize(item.status) === 'available'
    ).length
  }
}

export function renderCommands () {
  const container = document.getElementById('commandsContainer')

  const searchInput = document.getElementById('searchInput')

  if (!container || !searchInput) {
    return
  }

  const query = normalize(searchInput.value)

  const filtered = allCommands
    .filter(cmd => {
      let matchesFilter = false

      if (currentFilter === 'all') {
        matchesFilter = true
      } else if (currentFilter === 'planned') {
        matchesFilter = normalize(cmd.status) === 'planned'
      } else {
        matchesFilter = normalize(cmd.category) === currentFilter
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

      const matchesSearch = !query || haystack.includes(query)

      return matchesFilter && matchesSearch
    })
    .sort((a, b) => {
      const aPlanned = normalize(a.status) === 'planned' ? 1 : 0

      const bPlanned = normalize(b.status) === 'planned' ? 1 : 0

      return aPlanned - bPlanned
    })

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty">
        *** NO MATCHES FOUND. TRY AGAIN, GENIUS.
      </div>
    `
    return
  }

  container.innerHTML = filtered
    .map(cmd => {
      const planned = normalize(cmd.status) === 'planned'

      const kind = kindLabel(cmd.kind)

      const displayName = cmd.name || cmd.command || 'UNKNOWN'

      return `
        <div class="command-card ${planned ? 'planned' : ''}">

          <div class="command-title">

            <div class="command-name">
              ${escapeHtml(displayName)}
            </div>

            <span class="badge ${planned ? 'planned' : 'status'}">
              ${planned ? 'COMING SOON' : categoryLabel(cmd.category)}
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
              Number(cmd.cost || 0) > 0
                ? `
                  <span class="badge cost">
                    ${Number(cmd.cost).toLocaleString()} SCHMECKLES
                  </span>
                `
                : ''
            }

            ${
              cmd.cooldown && normalize(cmd.cooldown) !== 'coming soon'
                ? `
                  <span class="badge cooldown">
                    ${escapeHtml(cmd.cooldown)}
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
            ${escapeHtml(cmd.description || '')}
          </div>

          ${
            cmd.example
              ? `
                <div class="command-example">
                  &gt; ${escapeHtml(cmd.example)}
                </div>
              `
              : ''
          }

        </div>
      `
    })
    .join('')
}

export function mergeCommands (items = []) {
  if (!Array.isArray(items)) {
    return
  }

  allCommands = [
    ...allCommands.filter(item => normalize(item.source) !== 'neon-redemption'),
    ...items
  ]

  updateStatus()
  renderCommands()
}

export function bindCommandUI () {
  const buttons = document.querySelectorAll('.nav-btn[data-filter]')

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(button => button.classList.remove('active'))

      btn.classList.add('active')

      currentFilter = btn.dataset.filter

      renderCommands()
    })
  })

  const searchInput = document.getElementById('searchInput')

  const findBtn = document.getElementById('findBtn')

  if (searchInput) {
    searchInput.addEventListener('input', renderCommands)
  }

  if (findBtn) {
    findBtn.addEventListener('click', renderCommands)
  }
}

export function updateStatus () {
  const { publicChatCommands, paidSfx } = getCommandStats()

  const statusBox = document.getElementById('statusBox')

  if (!statusBox) {
    return
  }

  statusBox.innerHTML = `
    CONNECTED TO OXNET_96<br>
    ECONOMY: SCHMECKLES<br>
    PUBLIC CHAT CMDS: ${publicChatCommands}<br>
    PAID SFX: ${paidSfx}<br>
    REDEEM: TWITCH CHAT<br>
    WATCH RATE: +1 / LIVE MIN<br>
    SFX RATE: 100 EACH<br>
    CLOCK IN: +100 / STREAM<br>
    FIRST CLAIM: +500<br>
    <br>
    BACKEND: CONNECTING
  `
}

export async function loadCommands () {
  try {
    const response = await fetch('./commands.json', {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('commands.json failed to load')
    }

    allCommands = await response.json()

    updateStatus()
    renderCommands()
  } catch (error) {
    console.error('OXNET command database failed.', error)

    allCommands = []

    const statusBox = document.getElementById('statusBox')

    const container = document.getElementById('commandsContainer')

    if (statusBox) {
      statusBox.innerHTML = `
        CONNECTED TO OXNET_96<br>
        COMMAND DATABASE: UNAVAILABLE<br>
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
