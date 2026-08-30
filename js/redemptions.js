import { API_URL } from './config.js'

let redemptionCatalog = []
let redemptionBound = false

function escapeHtml (value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatNumber (value) {
  return Number(value || 0)
    .toLocaleString()
}

function formatCooldown (seconds) {
  const value =
    Number(seconds || 0)

  if (!value) {
    return 'NO COOLDOWN'
  }

  if (value < 60) {
    return `${value} SEC`
  }

  if (value % 3600 === 0) {
    return `${value / 3600} HR`
  }

  if (value % 60 === 0) {
    return `${value / 60} MIN`
  }

  return `${value} SEC`
}

function getContainer () {
  return document.getElementById(
    'redemptionsContainer'
  )
}

function findRedemption (key) {
  return redemptionCatalog.find(
    item =>
      String(item.key) ===
      String(key)
  )
}

function renderRedemptionCard (item) {
  const cost =
    Number(item.cost || 0)

  return `
    <button
      type="button"
      class="command-card"
      data-redemption-open="${escapeHtml(
        item.key
      )}"
      style="
        width: 100%;
        min-height: 165px;
        margin: 0;
        padding: 10px;
        text-align: left;
        cursor: pointer;
        font: inherit;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      "
    >
      <div>
        <div class="command-title">
          <div class="command-name">
            ${escapeHtml(
              item.name ||
              item.key ||
              'UNKNOWN REDEMPTION'
            )}
          </div>

          ${
            item.category
              ? `
                <span class="badge status">
                  ${escapeHtml(
                    String(
                      item.category
                    ).toUpperCase()
                  )}
                </span>
              `
              : ''
          }

          <span class="badge cost">
            ${
              cost > 0
                ? `${formatNumber(cost)} SCHMECKLES`
                : 'FREE'
            }
          </span>
        </div>

        <div class="command-desc">
          ${escapeHtml(
            item.description ||
            'No description supplied.'
          )}
        </div>
      </div>

      <div
        style="
          margin-top: 12px;
          font-family:
            'Courier New',
            monospace;
          font-size: 11px;
          font-weight: bold;
        "
      >
        COOLDOWN:
        ${escapeHtml(
          formatCooldown(
            item.cooldown_seconds
          )
        )}

        <br><br>

        VIEW REDEMPTION &gt;
      </div>
    </button>
  `
}

export function showRedemptionDirectory () {
  const container =
    getContainer()

  if (!container) {
    return
  }

  if (!redemptionCatalog.length) {
    container.innerHTML = `
      <div class="empty">
        *** NO REDEMPTIONS CURRENTLY AVAILABLE.
      </div>
    `

    return
  }

  const sorted = [
    ...redemptionCatalog
  ].sort((a, b) => {
    const costDifference =
      Number(a.cost || 0) -
      Number(b.cost || 0)

    if (costDifference !== 0) {
      return costDifference
    }

    return String(
      a.name || ''
    ).localeCompare(
      String(
        b.name || ''
      ),
      undefined,
      {
        sensitivity: 'base'
      }
    )
  })

  container.innerHTML = `
    <div
      class="status-box"
      style="
        margin: 0 0 10px;
        min-height: 0;
      "
    >
      OXNET REDEMPTION CATALOG //
      ${sorted.length.toLocaleString()}
      AVAILABLE
    </div>

    <div
      style="
        display: grid;
        grid-template-columns:
          repeat(
            auto-fill,
            minmax(210px, 1fr)
          );
        gap: 8px;
      "
    >
      ${sorted
        .map(renderRedemptionCard)
        .join('')}
    </div>
  `
}

function renderRedemptionDetail (item) {
  const container =
    getContainer()

  if (!container) {
    return
  }

  const cost =
    Number(item.cost || 0)

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
        data-redemption-back
      >
        &lt; REDEMPTIONS
      </button>

      <div
        class="status-box"
        style="
          margin: 0;
          min-height: 0;
          flex: 1;
        "
      >
        REDEMPTION //
        ${escapeHtml(
          item.name ||
          item.key
        )}
      </div>
    </div>

    <div
      class="command-card"
      style="
        margin: 0;
        padding: 12px;
      "
    >
      <div class="command-title">
        <div
          class="command-name"
          style="font-size: 20px;"
        >
          ${escapeHtml(
            item.name ||
            item.key
          )}
        </div>

        <span class="badge cost">
          ${
            cost > 0
              ? `${formatNumber(cost)} SCHMECKLES`
              : 'FREE'
          }
        </span>

        ${
          item.category
            ? `
              <span class="badge status">
                ${escapeHtml(
                  String(
                    item.category
                  ).toUpperCase()
                )}
              </span>
            `
            : ''
        }
      </div>

      <div
        class="command-desc"
        style="
          margin-top: 12px;
          font-size: 14px;
          line-height: 1.5;
        "
      >
        ${escapeHtml(
          item.description ||
          'No description supplied.'
        )}
      </div>

      <div
        style="
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(170px, 1fr)
            );
          gap: 8px;
          margin-top: 14px;
        "
      >
        <div
          class="status-box"
          style="margin: 0;"
        >
          COST
          <br><br>
          <strong>
            ${
              cost > 0
                ? `${formatNumber(cost)} SCHMECKLES`
                : 'FREE'
            }
          </strong>
        </div>

        <div
          class="status-box"
          style="margin: 0;"
        >
          COOLDOWN
          <br><br>
          <strong>
            ${escapeHtml(
              formatCooldown(
                item.cooldown_seconds
              )
            )}
          </strong>
        </div>

        <div
          class="status-box"
          style="margin: 0;"
        >
          REDEMPTION ID
          <br><br>
          <strong>
            ${escapeHtml(
              item.key
            )}
          </strong>
        </div>
      </div>

      <div
        class="status-box"
        style="
          margin: 12px 0 0;
          min-height: 0;
        "
      >
        PORTAL REDEMPTION EXECUTION:
        COMING NEXT
        <br>
        CATALOG + COST DATA ARE LIVE.
      </div>
    </div>
  `
}

function bindRedemptionUi () {
  const container =
    getContainer()

  if (
    !container ||
    redemptionBound
  ) {
    return
  }

  redemptionBound = true

  container.addEventListener(
    'click',
    event => {
      const open =
        event.target.closest(
          '[data-redemption-open]'
        )

      if (open) {
        const item =
          findRedemption(
            open.dataset
              .redemptionOpen
          )

        if (item) {
          renderRedemptionDetail(
            item
          )
        }

        return
      }

      const back =
        event.target.closest(
          '[data-redemption-back]'
        )

      if (back) {
        showRedemptionDirectory()
      }
    }
  )
}

export async function loadRedemptions () {
  const container =
    getContainer()

  bindRedemptionUi()

  if (container) {
    container.innerHTML =
      'CONNECTING TO OXNET REDEMPTION DATABASE...'
  }

  try {
    const response =
      await fetch(
        `${API_URL}/redemptions`,
        {
          cache: 'no-store'
        }
      )

    const data =
      await response.json()

    if (!response.ok) {
      throw new Error(
        data.error ||
        `HTTP ${response.status}`
      )
    }

    redemptionCatalog =
      Array.isArray(
        data.redemptions
      )
        ? data.redemptions
        : []

    showRedemptionDirectory()
  } catch (error) {
    console.error(
      'OXNET redemption catalog failed.',
      error
    )

    redemptionCatalog = []

    if (container) {
      container.innerHTML = `
        <div class="empty">
          *** REDEMPTION DATABASE FAILED TO LOAD.
          <br><br>
          ${escapeHtml(
            error.message
          )}
        </div>
      `
    }
  }
}
