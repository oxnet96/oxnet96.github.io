import { API_URL } from './config.js'
import { escapeHtml } from './commands.js'

const PLATFORM_LOGO_BASE = 'assets/console-logos'

/*
  OXNET platform-logo map.

  Keys are normalized to uppercase letters/numbers only, so database values
  such as "Game Boy Advance", "GAMEBOY ADVANCE", "GBA", etc. can all point
  to the same stable logo filename.

  The actual PNG files in assets/console-logos use lowercase canonical names.
*/
const PLATFORM_LOGO_FILES = {
  // Nintendo home consoles
  NES: 'nes.png',
  NINTENDOENTERTAINMENTSYSTEM: 'nes.png',

  SNES: 'snes.png',
  SUPERNINTENDO: 'snes.png',
  SUPERNINTENDOENTERTAINMENTSYSTEM: 'snes.png',

  N64: 'nintendo-64.png',
  NINTENDO64: 'nintendo-64.png',

  // Nintendo handhelds
  GAMEBOY: 'game-boy.png',
  NINTENDOGAMEBOY: 'game-boy.png',

  GBC: 'game-boy-color.png',
  GAMEBOYCOLOR: 'game-boy-color.png',
  NINTENDOGAMEBOYCOLOR: 'game-boy-color.png',

  GBA: 'game-boy-advance.png',
  GAMEBOYADVANCE: 'game-boy-advance.png',
  NINTENDOGAMEBOYADVANCE: 'game-boy-advance.png',

  NDS: 'nintendo-ds.png',
  DS: 'nintendo-ds.png',
  NINTENDODS: 'nintendo-ds.png',

  // Sega
  GENESIS: 'genesis.png',
  SEGAGENESIS: 'genesis.png',
  MEGADRIVE: 'genesis.png',
  SEGAMEGADRIVE: 'genesis.png',

  '32X': 'sega-32x.png',
  SEGA32X: 'sega-32x.png',
  GENESIS32X: 'sega-32x.png',

  GAMEGEAR: 'game-gear.png',
  SEGAGAMEGEAR: 'game-gear.png',

  MASTERSYSTEM: 'master-system.png',
  SEGAMASTERSYSTEM: 'master-system.png',

  // Sony
  PS1: 'playstation.png',
  PSX: 'playstation.png',
  PLAYSTATION: 'playstation.png',
  PLAYSTATION1: 'playstation.png',
  SONYPLAYSTATION: 'playstation.png',

  // Atari
  ATARI2600: 'atari-2600.png',

  JAGUAR: 'atari-jaguar.png',
  ATARIJAGUAR: 'atari-jaguar.png',

  LYNX: 'atari-lynx.png',
  ATARILYNX: 'atari-lynx.png',

  // NEC
  TG16: 'turbografx-16.png',
  TURBOGRAFX16: 'turbografx-16.png',
  NECTURBOGRAFX16: 'turbografx-16.png',

  // Arcade
  MAME: 'mame.png'
}

function normalizePlatformName (platform) {
  return String(platform || 'UNKNOWN')
    .trim()
    .toUpperCase()
}

function normalizePlatformKey (platform) {
  return normalizePlatformName(platform)
    .replace(/[^A-Z0-9]/g, '')
}

function getPlatformLogo (platform) {
  const key = normalizePlatformKey(platform)
  const mappedFile = PLATFORM_LOGO_FILES[key]

  if (mappedFile) {
    return `${PLATFORM_LOGO_BASE}/${mappedFile}`
  }

  /*
    Future-proof fallback:
    if a new platform is added later and its logo is named after the platform
    in lowercase-kebab-case, OXNET will try it automatically before falling
    back to text.
  */
  const slug = normalizePlatformName(platform)
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
                    alt=""
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
