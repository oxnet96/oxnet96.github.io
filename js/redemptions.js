import {
  API_URL,
  SESSION_KEY
} from './config.js'

import {
  mergeCommands
} from './commands.js'

let jcVideoRedemption = null
let actionBindingInstalled = false

function closeJcVideoModal () {
  const overlay = document.getElementById('jcVideoSubmissionOverlay')

  if (overlay) {
    overlay.remove()
  }
}

function setFormStatus (message, isError = false) {
  const status = document.getElementById('jcVideoSubmissionStatus')

  if (!status) {
    return
  }

  status.textContent = message
  status.style.color = isError ? '#800000' : '#000080'
}

function openJcVideoModal () {
  closeJcVideoModal()

  if (!jcVideoRedemption) {
    window.alert('This redemption is currently unavailable.')
    return
  }

  const cost = Number(jcVideoRedemption.cost || 0)
  const maxDuration = Number(
    jcVideoRedemption.max_duration_seconds || 30
  )

  const overlay = document.createElement('div')
  overlay.id = 'jcVideoSubmissionOverlay'

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
          ×
        </button>
      </div>

      <form
        id="jcVideoSubmissionForm"
        style="
          padding: 12px;
        "
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
          <strong>${cost.toLocaleString()} SCHMECKLES</strong>
          <br>
          MAXIMUM LENGTH:
          <strong>${maxDuration} SECONDS</strong>
          <br><br>
          YOU ARE NOT CHARGED UNTIL THE SUBMISSION IS APPROVED.
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

  document.body.appendChild(overlay)

  overlay.addEventListener('click', event => {
    if (
      event.target === overlay ||
      event.target.closest('[data-jc-close]')
    ) {
      closeJcVideoModal()
    }
  })

  const form = document.getElementById('jcVideoSubmissionForm')

  form.addEventListener('submit', async event => {
    event.preventDefault()

    const session = localStorage.getItem(SESSION_KEY)

    if (!session) {
      setFormStatus(
        'LOGIN WITH TWITCH BEFORE SUBMITTING.',
        true
      )

      return
    }

    const submitButton =
      document.getElementById('jcVideoSubmitButton')

    submitButton.disabled = true
    submitButton.textContent = 'SUBMITTING...'

    setFormStatus('SENDING TO OXNET...')

    const videoUrl =
      document.getElementById('jcVideoUrl').value.trim()

    const durationSeconds = Number(
      document.getElementById('jcVideoDuration').value
    )

    const title =
      document.getElementById('jcVideoTitle').value.trim()

    const note =
      document.getElementById('jcVideoNote').value.trim()

    try {
      const response = await fetch(
        `${API_URL}/jc-video-submissions`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session}`
          },

          body: JSON.stringify({
            video_url: videoUrl,
            duration_seconds: durationSeconds,
            title,
            note
          })
        }
      )

      let data = {}

      try {
        data = await response.json()
      } catch {
        // Keep the generic HTTP error below.
      }

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem(SESSION_KEY)

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

      submitButton.textContent = 'SUBMITTED'

      setTimeout(() => {
        closeJcVideoModal()
      }, 1800)

      return
    } catch (error) {
      console.error(
        'JC video submission failed.',
        error
      )

      setFormStatus(
        error.message || 'SUBMISSION FAILED.',
        true
      )
    } finally {
      if (document.body.contains(submitButton)) {
        submitButton.disabled = false

        if (submitButton.textContent === 'SUBMITTING...') {
          submitButton.textContent = 'SUBMIT FOR REVIEW'
        }
      }
    }
  })

  document.getElementById('jcVideoUrl').focus()
}

function bindRedemptionActions () {
  if (actionBindingInstalled) {
    return
  }

  actionBindingInstalled = true

  document.addEventListener('click', event => {
    const button = event.target.closest(
      '[data-command-action="jc-video-submit"]'
    )

    if (!button) {
      return
    }

    openJcVideoModal()
  })
}

export async function loadRedemptions () {
  bindRedemptionActions()

  try {
    const response = await fetch(
      `${API_URL}/redemptions`,
      {
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      throw new Error(
        `Redemption API returned ${response.status}`
      )
    }

    const data = await response.json()

    const items = (data.redemptions || []).map(item => {
      const isJcVideo =
        item.key === 'jc_video_queue' &&
        item.enabled !== false

      if (isJcVideo) {
        jcVideoRedemption = item

        const maxDuration = Number(
          item.max_duration_seconds || 30
        )

        return {
          name: item.name,
          command: item.name,
          category: 'redemption',
          kind: 'portal',
          description: item.description || '',
          cost: Number(item.cost || 0),
          cooldown: `MAX ${maxDuration} SEC`,
          example:
            'SUBMIT A SHORT // APPROVAL REQUIRED // CHARGED ONLY IF APPROVED',
          status: 'available',
          isNew: true,
          redemption_key: item.key,
          action: 'jc-video-submit',
          action_label: 'SUBMIT VIDEO',
          source: 'neon-redemption'
        }
      }

      return {
        name: item.name,
        command: item.name,
        category: 'redemption',
        kind: 'planned',
        description: item.description || '',
        cost: 0,
        cooldown: 'COMING SOON',
        example: 'OXNET EXPANSION // COMING SOON',
        status: 'planned',
        isNew: false,
        redemption_key: item.key,
        source: 'neon-redemption'
      }
    })

    mergeCommands(items)
  } catch (error) {
    console.error(
      'OXNET redemption catalog failed.',
      error
    )
  }
}
