import {
  API_URL,
  SESSION_KEY
} from './config.js'

let redemptionCatalog = []
let redemptionBound = false
let jcVideoRedemption = null

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

function closeJcVideoModal () {
  const overlay =
    document.getElementById(
      'jcVideoSubmissionOverlay'
    )

  if (overlay) {
    overlay.remove()
  }
}

function setFormStatus (
  message,
  isError = false
) {
  const status =
    document.getElementById(
      'jcVideoSubmissionStatus'
    )

  if (!status) {
    return
  }

  status.textContent = message
  status.style.color =
    isError
      ? '#800000'
      : '#000080'
}

function openJcVideoModal () {
  closeJcVideoModal()

  if (
    !jcVideoRedemption ||
    jcVideoRedemption.enabled === false
  ) {
    window.alert(
      'This redemption is currently unavailable.'
    )

    return
  }

  const cost =
    Number(
      jcVideoRedemption.cost || 0
    )

  const maxDuration =
    Number(
      jcVideoRedemption
        .max_duration_seconds || 30
    )

  const overlay =
    document.createElement('div')

  overlay.id =
    'jcVideoSubmissionOverlay'

  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px;
    background: rgba(0, 0, 0, 0.72);
  `

  overlay.innerHTML = `
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="jcVideoSubmissionTitle"
      style="
        width: min(560px, 100%);
        max-height: calc(100vh - 28px);
        overflow-y: auto;
        border: 2px outset #ffffff;
        background: #c0c0c0;
        color: #000000;
        font-family: 'Courier New', monospace;
        box-shadow: 5px 5px 0 #000000;
      "
    >
      <div
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 5px 6px;
          background: #000080;
          color: #ffffff;
          font-weight: bold;
        "
      >
        <span id="jcVideoSubmissionTitle">
          OXNET // ADD TO JC QUEUE
        </span>

        <button
          type="button"
          data-jc-close
          aria-label="Close"
          style="
            width: 24px;
            height: 22px;
            padding: 0;
            border: 2px outset #ffffff;
            background: #c0c0c0;
            color: #000000;
            font-weight: bold;
            cursor: pointer;
          "
        >
          X
        </button>
      </div>

      <form
        id="jcVideoSubmissionForm"
        style="padding: 12px;"
      >
        <div
          style="
            margin-bottom: 12px;
            padding: 8px;
            border: 2px inset #ffffff;
            background: #ffffff;
            line-height: 1.4;
            font-size: 12px;
          "
        >
          COST IF APPROVED:
          <strong>
            ${cost.toLocaleString()}
            SCHMECKLES
          </strong>

          <br>

          MAXIMUM LENGTH:
          <strong>
            ${maxDuration}
            SECONDS
          </strong>

          <br><br>

          YOU ARE NOT CHARGED UNTIL
          THE SUBMISSION IS APPROVED.
        </div>

        <label
          for="jcVideoUrl"
          style="
            display: block;
            margin-bottom: 4px;
            font-weight: bold;
          "
        >
          VIDEO / SHORT URL *
        </label>

        <input
          id="jcVideoUrl"
          name="video_url"
          type="url"
          required
          maxlength="2048"
          placeholder="https://..."
          class="search"
          style="
            width: 100%;
            box-sizing: border-box;
            margin-bottom: 10px;
          "
        >

        <label
          for="jcVideoDuration"
          style="
            display: block;
            margin-bottom: 4px;
            font-weight: bold;
          "
        >
          VIDEO LENGTH IN SECONDS *
        </label>

        <input
          id="jcVideoDuration"
          name="duration_seconds"
          type="number"
          required
          min="1"
          max="${maxDuration}"
          inputmode="numeric"
          class="search"
          style="
            width: 100%;
            box-sizing: border-box;
            margin-bottom: 10px;
          "
        >

        <label
          for="jcVideoTitle"
          style="
            display: block;
            margin-bottom: 4px;
            font-weight: bold;
          "
        >
          TITLE / WHAT IS THIS?
        </label>

        <input
          id="jcVideoTitle"
          name="title"
          type="text"
          maxlength="120"
          class="search"
          style="
            width: 100%;
            box-sizing: border-box;
            margin-bottom: 10px;
          "
        >

        <label
          for="jcVideoNote"
          style="
            display: block;
            margin-bottom: 4px;
            font-weight: bold;
          "
        >
          NOTE FOR OX
        </label>

        <textarea
          id="jcVideoNote"
          name="note"
          maxlength="500"
          rows="4"
          class="search"
          style="
            width: 100%;
            box-sizing: border-box;
            resize: vertical;
            margin-bottom: 10px;
          "
        ></textarea>

        <div
          id="jcVideoSubmissionStatus"
          style="
            min-height: 18px;
            margin: 4px 0 10px;
            font-size: 12px;
            font-weight: bold;
          "
        ></div>

        <div
          style="
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          "
        >
          <button
            class="find-btn"
            type="submit"
            id="jcVideoSubmitButton"
          >
            SUBMIT FOR REVIEW
          </button>

          <button
            class="find-btn"
            type="button"
            data-jc-close
          >
            CANCEL
          </button>
        </div>
      </form>
    </div>
  `

  document.body.appendChild(
    overlay
  )

  overlay.addEventListener(
    'click',
    event => {
      if (
        event.target === overlay ||
        event.target.closest(
          '[data-jc-close]'
        )
      ) {
        closeJcVideoModal()
      }
    }
  )

  const form =
    document.getElementById(
      'jcVideoSubmissionForm'
    )

  form.addEventListener(
    'submit',
    async event => {
      event.preventDefault()

      const session =
        localStorage.getItem(
          SESSION_KEY
        )

      if (!session) {
        setFormStatus(
          'LOGIN WITH TWITCH BEFORE SUBMITTING.',
          true
        )

        return
      }

      const submitButton =
        document.getElementById(
          'jcVideoSubmitButton'
        )

      submitButton.disabled = true
      submitButton.textContent =
        'SUBMITTING...'

      setFormStatus(
        'SENDING TO OXNET...'
      )

      const videoUrl =
        document
          .getElementById(
            'jcVideoUrl'
          )
          .value
          .trim()

      const durationSeconds =
        Number(
          document
            .getElementById(
              'jcVideoDuration'
            )
            .value
        )

      const title =
        document
          .getElementById(
            'jcVideoTitle'
          )
          .value
          .trim()

      const note =
        document
          .getElementById(
            'jcVideoNote'
          )
          .value
          .trim()

      try {
        const response =
          await fetch(
            `${API_URL}/jc-video-submissions`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                'Authorization':
                  `Bearer ${session}`
              },

              body: JSON.stringify({
                video_url:
                  videoUrl,

                duration_seconds:
                  durationSeconds,

                title,

                note
              })
            }
          )

        let data = {}

        try {
          data =
            await response.json()
        } catch {
          // Use generic HTTP error.
        }

        if (!response.ok) {
          if (
            response.status === 401
          ) {
            localStorage.removeItem(
              SESSION_KEY
            )

            throw new Error(
              'TWITCH SESSION EXPIRED. LOG IN AGAIN.'
            )
          }

          throw new Error(
            data.error ||
            `OXNET RETURNED ${response.status}`
          )
        }

        setFormStatus(
          'SUBMISSION RECEIVED // PENDING REVIEW // NOT CHARGED YET'
        )

        form.reset()

        submitButton.textContent =
          'SUBMITTED'

        setTimeout(() => {
          closeJcVideoModal()
        }, 1800)
      } catch (error) {
        console.error(
          'JC video submission failed.',
          error
        )

        setFormStatus(
          error.message ||
          'SUBMISSION FAILED.',
          true
        )
      } finally {
        if (
          document.body.contains(
            submitButton
          )
        ) {
          submitButton.disabled = false

          if (
            submitButton.textContent ===
            'SUBMITTING...'
          ) {
            submitButton.textContent =
              'SUBMIT FOR REVIEW'
          }
        }
      }
    }
  )

  document
    .getElementById(
      'jcVideoUrl'
    )
    .focus()
}

function renderRedemptionCard (
  item
) {
  const cost =
    Number(item.cost || 0)

  const isVideo =
    item.key === 'jc_video_queue'

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
        ${
          isVideo
            ? `MAX LENGTH: ${Number(
                item.max_duration_seconds ||
                30
              )} SEC`
            : `COOLDOWN: ${escapeHtml(
                formatCooldown(
                  item.cooldown_seconds
                )
              )}`
        }

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

function renderRedemptionDetail (
  item
) {
  const container =
    getContainer()

  if (!container) {
    return
  }

  const cost =
    Number(item.cost || 0)

  const isVideo =
    item.key === 'jc_video_queue' &&
    item.enabled !== false

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

        ${
          isVideo
            ? `
              <div
                class="status-box"
                style="margin: 0;"
              >
                MAXIMUM LENGTH
                <br><br>
                <strong>
                  ${Number(
                    item.max_duration_seconds ||
                    30
                  )}
                  SECONDS
                </strong>
              </div>
            `
            : `
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
            `
        }

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

      ${
        isVideo
          ? `
            <div
              class="status-box"
              style="
                margin: 12px 0 0;
                min-height: 0;
              "
            >
              SUBMISSIONS ARE REVIEWED FIRST.
              <br>
              YOU ARE CHARGED ONLY IF APPROVED.
            </div>

            <button
              type="button"
              class="find-btn"
              data-redemption-submit-video
              style="
                margin-top: 10px;
                min-height: 42px;
              "
            >
              SUBMIT VIDEO
            </button>
          `
          : `
            <div
              class="status-box"
              style="
                margin: 12px 0 0;
                min-height: 0;
              "
            >
              PORTAL REDEMPTION EXECUTION:
              COMING NEXT
            </div>
          `
      }
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
        return
      }

      const submitVideo =
        event.target.closest(
          '[data-redemption-submit-video]'
        )

      if (submitVideo) {
        openJcVideoModal()
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

    jcVideoRedemption =
      redemptionCatalog.find(
        item =>
          item.key ===
            'jc_video_queue' &&
          item.enabled !== false
      ) || null

    showRedemptionDirectory()
  } catch (error) {
    console.error(
      'OXNET redemption catalog failed.',
      error
    )

    redemptionCatalog = []
    jcVideoRedemption = null

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
