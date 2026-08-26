import {
  API_URL,
  SESSION_KEY
} from '../js/config.js'


function getSession () {
  return localStorage.getItem(
    SESSION_KEY
  )
}


function showDenied (
  message = 'ADMIN ACCESS REQUIRED'
) {
  document
    .getElementById('adminAuthPanel')
    .hidden = true

  document
    .getElementById('adminControlPanel')
    .hidden = true

  document
    .getElementById('adminDeniedPanel')
    .hidden = false

  const deniedPanel =
    document.getElementById(
      'adminDeniedPanel'
    )

  const status =
    deniedPanel.querySelector(
      '.panel-header'
    )

  if (status) {
    status.textContent = message
  }
}


function showAdmin (data) {
  document
    .getElementById('adminAuthPanel')
    .hidden = true

  document
    .getElementById('adminDeniedPanel')
    .hidden = true

  document
    .getElementById('adminControlPanel')
    .hidden = false

  document
    .getElementById('adminUser')
    .textContent =
      data.user ||
      data.login ||
      'OXNET ADMIN'

  document
    .getElementById('adminApiStatus')
    .textContent =
      'ONLINE'
}


function bindNavigation () {
  const buttons =
    document.querySelectorAll(
      '[data-admin-view]'
    )

  const views =
    document.querySelectorAll(
      '.admin-view'
    )

  buttons.forEach(button => {

    button.addEventListener(
      'click',
      () => {

        buttons.forEach(btn =>
          btn.classList.remove(
            'active'
          )
        )

        button.classList.add(
          'active'
        )

        const target =
          button.dataset.adminView

        views.forEach(view => {
          view.hidden = true
        })

        const targetView =
          document.getElementById(
            `adminView${
              target
                .charAt(0)
                .toUpperCase() +
              target.slice(1)
            }`
          )

        if (targetView) {
          targetView.hidden = false
        }
      }
    )
  })
}


function bindButtons () {
  const loginBtn =
    document.getElementById(
      'adminLoginBtn'
    )

  const logoutBtn =
    document.getElementById(
      'adminLogoutBtn'
    )

  const portalBtn =
    document.getElementById(
      'returnToPortalBtn'
    )

  if (loginBtn) {
    loginBtn.addEventListener(
      'click',
      () => {
        window.location.href =
          `${API_URL}/auth/twitch`
      }
    )
  }

  if (logoutBtn) {
    logoutBtn.addEventListener(
      'click',
      () => {
        localStorage.removeItem(
          SESSION_KEY
        )

        window.location.reload()
      }
    )
  }

  if (portalBtn) {
    portalBtn.addEventListener(
      'click',
      () => {
        window.location.href =
          '../'
      }
    )
  }
}


async function loadDashboard () {
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
        `Queue returned ${response.status}`
      )
    }

    const data =
      await response.json()

    document
      .getElementById(
        'adminGameCount'
      )
      .textContent =
        Number(
          data.games?.length || 0
        ).toLocaleString()

  } catch (error) {
    console.error(
      'Admin dashboard queue lookup failed.',
      error
    )

    document
      .getElementById(
        'adminGameCount'
      )
      .textContent =
        'ERROR'
  }
}


async function verifyAdmin () {
  const session =
    getSession()

  if (!session) {
    showDenied(
      'TWITCH LOGIN REQUIRED'
    )

    return
  }

  try {
    const response =
      await fetch(
        `${API_URL}/admin/me`,
        {
          cache: 'no-store',

          headers: {
            Authorization:
              `Bearer ${session}`
          }
        }
      )

    const data =
      await response.json()

    if (
      !response.ok ||
      !data.admin
    ) {
      if (
        response.status === 401
      ) {
        localStorage.removeItem(
          SESSION_KEY
        )
      }

      showDenied(
        'ACCESS DENIED'
      )

      return
    }

    showAdmin(data)

    await loadDashboard()

  } catch (error) {
    console.error(
      'OXNET admin verification failed.',
      error
    )

    const status =
      document.getElementById(
        'adminAuthStatus'
      )

    status.textContent =
      '*** OXNET SECURITY SERVER UNAVAILABLE.'
  }
}


function startAdmin () {
  bindNavigation()
  bindButtons()
  verifyAdmin()
}


startAdmin()