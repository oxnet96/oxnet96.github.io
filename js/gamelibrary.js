import { API_URL } from './config.js'
import { escapeHtml } from './commands.js'

const PLATFORM_LOGO_BASE = 'assets/console-logos'

const PLATFORM_LOGO_ALIASES = {
  NES: 'nes.png',
  'NINTENDO ENTERTAINMENT SYSTEM': 'nes.png',

  SNES: 'super-nintendo.png',
  'SUPER NINTENDO': 'super-nintendo.png',
  'SUPER NINTENDO ENTERTAINMENT SYSTEM': 'super-nintendo.png',
  'SUPER FAMICOM': 'super-famicom.png',
  FAMICOM: 'family-computer.png',

  GENESIS: 'genesis.png',
  'SEGA GENESIS': 'genesis.png',
  'MEGA DRIVE': 'mega-drive.png',
  'SEGA MEGA DRIVE': 'mega-drive.png',
  '32X': 'genesis-32x.png',
  'SEGA 32X': 'genesis-32x.png',
  'GENESIS 32X': 'genesis-32x.png',
  'MASTER SYSTEM': 'sega-master-system.png',
  'SEGA MASTER SYSTEM': 'sega-master-system.png',
  'MARK III': 'mark-iii.png',
  'SG-1000': 'sg-1000.png',
  'SEGA CD': 'sega-cd.png',
  'MEGA CD': 'mega-cd.png',
  'MEGA CD II': 'mega-cd-ii.png',
  SATURN: 'sega-saturn.png',
  'SEGA SATURN': 'sega-saturn.png',
  DREAMCAST: 'dreamcast.png',
  'SEGA DREAMCAST': 'dreamcast.png',

  N64: 'nintendo-64.png',
  'NINTENDO 64': 'nintendo-64.png',
  'NINTENDO 64DD': 'nintendo-64-dd.png',
  'NINTENDO 64 DD': 'nintendo-64-dd.png',
  GAMECUBE: 'gamecube.png',
  'NINTENDO GAMECUBE': 'gamecube.png',
  WII: 'wii.png',
  'WII U': 'wii-u.png',
  SWITCH: 'switch.png',
  'NINTENDO SWITCH': 'switch.png',

  PS1: 'playstation.png',
  PSX: 'playstation.png',
  PLAYSTATION: 'playstation.png',
  'PLAYSTATION 1': 'playstation.png',
  PS2: 'ps-2.png',
  'PLAYSTATION 2': 'ps-2.png',
  PS3: 'ps3.png',
  'PLAYSTATION 3': 'ps3.png',
  PS4: 'ps4.png',
  'PLAYSTATION 4': 'ps4.png',

  XBOX: 'xbox.png',
  'XBOX 360': 'xbox-360.png',
  'XBOX ONE': 'xbox-one.png',

  'ATARI 2600': 'atari-2600.png',
  'ATARI 5200': 'atari-5200.png',
  'ATARI 7800': 'atari-7800.png',
  'ATARI XE': 'atari-xe.png',
  JAGUAR: 'jaguar.png',
  'ATARI JAGUAR': 'jaguar.png',
  'JAGUAR CD': 'jaguar-cd.png',
  'ATARI JAGUAR CD': 'jaguar-cd.png',

  'NEO GEO': 'neo-geo.png',
  'NEO-GEO': 'neo-geo.png',
  'NEO GEO CD': 'neo-geo-cd.png',
  'NEO-GEO CD': 'neo-geo-cd.png',

  '3DO': '3do.png',
  'CD-I': 'cd-i.png',
  CDI: 'cd-i.png',
  'PHILIPS CD-I': 'cd-i.png',
  'PC ENGINE': 'pc-engine.png',
  'PC-FX': 'pc-fx.png',
  'TURBOGRAFX-16': 'turbo-grafx-16.png',
  'TURBOGRAFX 16': 'turbo-grafx-16.png',
  'TURBO GRAFX 16': 'turbo-grafx-16.png',
  'SUPERGRAFX': 'super-grafx.png',
  'SUPER GRAFX': 'super-grafx.png',
  'ODYSSEY2': 'odyssey2.png',
  'ODYSSEY 2': 'odyssey2.png',

  COLECOVISION: 'coleco-vision.png',
  'COLECO VISION': 'coleco-vision.png',
  INTELLIVISION: 'intellivision.png',
  VECTREX: 'vectrex.png',
  'COMMODORE 64': 'commodore64.png',
  C64: 'commodore64.png',
  'AMIGA CD32': 'amiga-cd-32.png',
  'AMIGA CD 32': 'amiga-cd-32.png',

  // Arcade library
  MAME: 'mame.png'
}

function normalizePlatformName (platform) {
  return String(platform || 'UNKNOWN')
    .trim()
    .toUpperCase()
}

function getPlatformLogo (platform) {
  const name = normalizePlatformName(platform)

  if (PLATFORM_LOGO_ALIASES[name]) {
    return `${PLATFORM_LOGO_BASE}/${PLATFORM_LOGO_ALIASES[name]}`
  }

  const slug = name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${PLATFORM_LOGO_BASE}/${slug}.png`
}

function activateLogoFallbacks (container) {
  container
    .querySelectorAll('.console-logo')
    .forEach(image => {
      const showFallback = () => {
        image.hidden = true

        const fallback = image
          .closest('.console-logo-wrap')
          ?.querySelector('.console-logo-fallback')

        if (fallback) {
          fallback.hidden = false
        }
      }

      image.addEventListener('error', showFallback, { once: true })

      // Handles an image that failed before the listener was attached.
      if (image.complete && image.naturalWidth === 0) {
        showFallback()
      }
    })
}

function getGameStatus (game) {
  if (game.completed) {
    return 'COMPLETED'
  }

  if (game.request_type === 'donation') {
    return 'DONATION ONLY'
  }

  if (game.request_type === 'community') {
    return 'COMMUNITY'
  }

  return 'AVAILABLE'
}

function renderLibrary (allGames, containerId, mode = 'available') {
  const container = document.getElementById(containerId)

  if (!container) {
    return
  }

  const games =
    mode === 'completed'
      ? allGames.filter(game => game.completed)
      : allGames.filter(game => !game.completed)

  if (!games.length) {
    container.innerHTML = `
      <div class="empty">
        ${
          mode === 'completed'
            ? '*** NO COMPLETED GAMES YET.'
            : '*** GAME LIBRARY EMPTY.'
        }
      </div>
    `

    return
  }

  function showPlatforms () {
    const platformMap = new Map()

    games.forEach(game => {
      const platform = normalizePlatformName(game.platform)

      platformMap.set(
        platform,
        (platformMap.get(platform) || 0) + 1
      )
    })

    const platforms = Array
      .from(platformMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))

    container.innerHTML = `
      <div
        class="status-box"
        style="
          margin: 0 0 12px;
          min-height: 0;
        "
      >
        ${
          mode === 'completed'
            ? 'OXNET COMPLETED SOFTWARE ARCHIVE'
            : 'OXNET SOFTWARE ARCHIVE'
        }

        <br>

        ${games.length.toLocaleString()}
        TITLES

        <br><br>

        SELECT CONSOLE.
      </div>

      <div
        style="
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(140px, 1fr)
            );
          gap: 8px;
        "
      >
        <button
          class="find-btn"
          data-library-platform="ALL"
          aria-label="All games — ${games.length} titles"
          style="
            min-height: 96px;
            font-family:
              'Courier New',
              monospace;
          "
        >
          ALL GAMES
          <br>
          [${games.length}]
        </button>

        ${platforms
          .map(
            ([platform, count], index) => `
              <button
                class="find-btn console-platform-btn"
                data-library-platform-index="${index}"
                aria-label="${escapeHtml(platform)} — ${count} titles"
                title="${escapeHtml(platform)}"
                style="
                  min-height: 96px;
                  padding: 7px 8px;
                  font-family:
                    'Courier New',
                    monospace;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  gap: 5px;
                  overflow: hidden;
                "
              >
                <div
                  class="console-logo-wrap"
                  style="
                    width: 100%;
                    height: 62px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                  "
                >
                  <img
                    class="console-logo"
                    src="${getPlatformLogo(platform)}"
                    alt="${escapeHtml(platform)}"
                    loading="lazy"
                    style="
                      display: block;
                      width: auto;
                      height: auto;
                      max-width: 132px;
                      max-height: 58px;
                      object-fit: contain;
                    "
                  >

                  <span
                    class="console-logo-fallback"
                    hidden
                    style="
                      font-family:
                        'Courier New',
                        monospace;
                      font-size: 12px;
                      font-weight: bold;
                      line-height: 1.15;
                      text-align: center;
                      overflow-wrap: anywhere;
                    "
                  >
                    ${escapeHtml(platform)}
                  </span>
                </div>

                <div
                  class="console-game-count"
                  style="
                    font-family:
                      'Courier New',
                      monospace;
                    font-size: 11px;
                    line-height: 1;
                  "
                >
                  [${count}]
                </div>
              </button>
            `
          )
          .join('')}
      </div>
    `

    activateLogoFallbacks(container)

    const allButton = container.querySelector(
      '[data-library-platform="ALL"]'
    )

    if (allButton) {
      allButton.addEventListener('click', () => {
        showGames(null)
      })
    }

    container
      .querySelectorAll('[data-library-platform-index]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const index = Number(
            button.dataset.libraryPlatformIndex
          )

          const platform = platforms[index]?.[0]

          if (!platform) {
            return
          }

          showGames(platform)
        })
      })
  }

  function showGames (platform) {
    const platformGames = platform
      ? games.filter(
          game =>
            normalizePlatformName(game.platform) === platform
        )
      : [...games]

    const heading = platform || 'ALL GAMES'

    container.innerHTML = `
      <div
        style="
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        "
      >
        <button
          class="find-btn"
          data-library-back
        >
          &lt; CONSOLES
        </button>

        <div
          class="status-box"
          style="
            margin: 0;
            min-height: 0;
            flex: 1;
          "
        >
          ${escapeHtml(heading)}
          //

          ${mode === 'completed' ? 'COMPLETED' : 'LIBRARY'}

          //

          ${platformGames.length}
          TITLES
        </div>
      </div>

      <div
        style="
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        "
      >
        <input
          class="search"
          data-library-search
          type="text"
          placeholder="SEARCH GAME OR G####..."
          style="
            flex: 1;
            min-width: 180px;
          "
        >

        <button
          class="find-btn"
          data-library-clear
        >
          CLEAR
        </button>
      </div>

      <div data-library-results></div>
    `

    const results = container.querySelector(
      '[data-library-results]'
    )

    const search = container.querySelector(
      '[data-library-search]'
    )

    const backButton = container.querySelector(
      '[data-library-back]'
    )

    const clearButton = container.querySelector(
      '[data-library-clear]'
    )

    function renderResults (query = '') {
      const searchText = String(query)
        .trim()
        .toLowerCase()

      const filtered = platformGames.filter(game => {
        if (!searchText) {
          return true
        }

        return (
          String(game.game_name || '')
            .toLowerCase()
            .includes(searchText) ||
          String(game.library_code || '')
            .toLowerCase()
            .includes(searchText)
        )
      })

      if (!filtered.length) {
        results.innerHTML = `
          <div class="empty">
            *** NO MATCHING SOFTWARE FOUND.
          </div>
        `

        return
      }

      results.innerHTML = filtered
        .map(game => {
          const status = getGameStatus(game)

          const requestable =
            !game.completed &&
            game.request_type === 'schmeckles'

          return `
            <div class="command-card">
              <div class="command-title">
                <div class="command-name">
                  ${escapeHtml(game.game_name)}
                </div>

                <span class="badge">
                  ${escapeHtml(game.library_code)}
                </span>

                <span class="badge status">
                  ${escapeHtml(status)}
                </span>
              </div>

              <div class="command-desc">
                PLATFORM:
                ${escapeHtml(game.platform)}

                ${
                  mode === 'completed' &&
                  game.completed_at
                    ? `
                      <br>
                      COMPLETED:
                      ${escapeHtml(
                        new Date(
                          game.completed_at
                        ).toLocaleDateString()
                      )}
                    `
                    : ''
                }

                ${
                  mode !== 'completed'
                    ? `
                      <br>

                      ${
                        game.request_type === 'schmeckles'
                          ? `
                            COST:
                            ${Number(
                              game.schmeckle_cost || 0
                            ).toLocaleString()}
                            SCHMECKLES
                          `
                          : `
                            REQUEST TYPE:
                            ${escapeHtml(status)}
                          `
                      }
                    `
                    : ''
                }
              </div>

              ${
                requestable
                  ? `
                    <div class="command-example">
                      &gt;
                      !addgame
                      ${escapeHtml(game.library_code)}
                    </div>

                    <button
                      class="find-btn"
                      data-copy-game-command="!addgame ${escapeHtml(
                        game.library_code
                      )}"
                      style="
                        margin-top: 8px;
                      "
                    >
                      COPY REQUEST COMMAND
                    </button>
                  `
                  : mode === 'completed'
                    ? `
                      <div class="command-example">
                        &gt;
                        ARCHIVED //
                        COMPLETED
                      </div>
                    `
                    : `
                      <div class="command-example">
                        &gt;
                        SPECIAL REQUEST //
                        NOT AVAILABLE FOR
                        SCHMECKLES
                      </div>
                    `
              }
            </div>
          `
        })
        .join('')
    }

    renderResults()

    search.addEventListener('input', () => {
      renderResults(search.value)
    })

    clearButton.addEventListener('click', () => {
      search.value = ''

      renderResults()

      search.focus()
    })

    backButton.addEventListener(
      'click',
      showPlatforms
    )

    results.addEventListener(
      'click',
      async event => {
        const button = event.target.closest(
          '[data-copy-game-command]'
        )

        if (!button) {
          return
        }

        const command =
          button.dataset.copyGameCommand

        try {
          await navigator.clipboard.writeText(
            command
          )

          const original = button.textContent

          button.textContent = 'COPIED.'

          setTimeout(() => {
            button.textContent = original
          }, 1200)
        } catch (error) {
          console.error(
            'Clipboard failed.',
            error
          )

          window.prompt(
            'COPY THIS COMMAND:',
            command
          )
        }
      }
    )
  }

  showPlatforms()
}

async function loadLibrary (containerId, mode) {
  const container = document.getElementById(
    containerId
  )

  if (!container) {
    return
  }

  container.innerHTML =
    'CONNECTING TO OXNET SOFTWARE ARCHIVE...'

  try {
    const response = await fetch(
      `${API_URL}/game-library`,
      {
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      throw new Error(
        `Game library returned ${response.status}`
      )
    }

    const data = await response.json()

    renderLibrary(
      data.games || [],
      containerId,
      mode
    )
  } catch (error) {
    console.error(
      'OXNET game library failed.',
      error
    )

    container.innerHTML = `
      <div class="empty">
        *** OXNET SOFTWARE ARCHIVE UNAVAILABLE.
      </div>
    `
  }
}

export function loadGameLibrary () {
  return loadLibrary(
    'gameLibraryContainer',
    'available'
  )
}

export function loadCompletedGames () {
  return loadLibrary(
    'completedGamesContainer',
    'completed'
  )
}
