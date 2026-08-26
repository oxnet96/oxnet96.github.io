import {
  API_URL
} from './config.js'

import {
  escapeHtml
} from './commands.js'

function renderQueue (games) {
  const container =
    document.getElementById(
      'gameQueueContainer'
    )

  if (!container) {
    return
  }

  if (!games.length) {
    container.innerHTML = `
      <div class="empty">
        *** GAME REQUEST QUEUE IS EMPTY.
        <br><br>
        USE !addgame &lt;game&gt; IN TWITCH CHAT
        TO MAKE A POOR PROGRAMMING DECISION.
      </div>
    `

    return
  }

  container.innerHTML =
    games.map(game => {

      const playing =
        game.status === 'playing'

      return `
        <div class="command-card">

          <div class="command-title">

            <div class="command-name">
              ${
                playing
                  ? '▶ NOW PLAYING'
                  : `#${game.position}`
              }
              // ${escapeHtml(game.game_name)}
            </div>

            <span class="badge ${
              playing
                ? 'status'
                : 'kind'
            }">
              ${
                playing
                  ? 'PLAYING'
                  : 'QUEUED'
              }
            </span>

            <span class="badge">
              REQUEST #${game.id}
            </span>

          </div>

          <div class="command-desc">
            REQUESTED BY:
            ${escapeHtml(game.requested_by)}
          </div>

          <div class="command-example">
            &gt; PRIORITY:
            ${Number(game.priority || 0)}
          </div>

        </div>
      `
    })
      .join('')
}


export async function loadGameQueue () {
  const container =
    document.getElementById(
      'gameQueueContainer'
    )

  if (!container) {
    return
  }

  try {
    const response =
      await fetch(
        `${API_URL}/game-queue`,
        {
          cache: 'no-store'
        }
      )

    if (!response.ok) {
      throw new Error(
        `Game queue returned ${response.status}`
      )
    }

    const data =
      await response.json()

    renderQueue(
      data.games || []
    )
  }
  catch (error) {
    console.error(
      'OXNET game queue failed.',
      error
    )

    container.innerHTML = `
      <div class="empty">
        *** OXNET PROGRAMMING DATABASE UNAVAILABLE.
      </div>
    `
  }
}