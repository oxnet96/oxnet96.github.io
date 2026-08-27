import { API_URL, SESSION_KEY } from "../js/config.js";

function getSession() {
  return localStorage.getItem(SESSION_KEY);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function adminFetch(path, options = {}) {
  const session = getSession();

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${session}`,
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
}

function showDenied(message = "ADMIN ACCESS REQUIRED") {
  document.getElementById("adminAuthPanel").hidden = true;

  document.getElementById("adminControlPanel").hidden = true;

  document.getElementById("adminDeniedPanel").hidden = false;

  const deniedPanel = document.getElementById("adminDeniedPanel");

  const header = deniedPanel.querySelector(".panel-header");

  if (header) {
    header.textContent = message;
  }
}

function showAdmin(data) {
  document.getElementById("adminAuthPanel").hidden = true;

  document.getElementById("adminDeniedPanel").hidden = true;

  document.getElementById("adminControlPanel").hidden = false;

  document.getElementById("adminUser").textContent =
    data.user || data.login || "OXNET ADMIN";

  document.getElementById("adminApiStatus").textContent = "ONLINE";
}

function bindNavigation() {
  const buttons = document.querySelectorAll("[data-admin-view]");

  const views = document.querySelectorAll(".admin-view");

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      buttons.forEach((btn) => btn.classList.remove("active"));

      button.classList.add("active");

      const target = button.dataset.adminView;

      views.forEach((view) => {
        view.hidden = true;
      });

      const targetView = document.getElementById(
        `adminView${target.charAt(0).toUpperCase() + target.slice(1)}`,
      );

      if (targetView) {
        targetView.hidden = false;
      }

      if (target === "games") {
        await loadAdminGames();
      }

      if (target === "library") {
        await loadAdminLibrary();
      }
    });
  });
}

function bindButtons() {
  const loginBtn = document.getElementById("adminLoginBtn");

  const logoutBtn = document.getElementById("adminLogoutBtn");

  const portalBtn = document.getElementById("returnToPortalBtn");

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      window.location.href = `${API_URL}/auth/twitch`;
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(SESSION_KEY);

      window.location.reload();
    });
  }

  if (portalBtn) {
    portalBtn.addEventListener("click", () => {
      window.location.href = "../";
    });
  }
}

function renderAdminGames(games) {
  const container = document.getElementById("adminGameQueue");

  if (!container) {
    return;
  }

  if (!games.length) {
    container.innerHTML = `
      <div class="empty">
        *** PROGRAMMING QUEUE EMPTY.
        <br><br>
        FOR ONCE, NOBODY HAS MADE
        A TERRIBLE REQUEST.
      </div>
    `;

    return;
  }

  container.innerHTML = games
    .map((game) => {
      const playing = game.status === "playing";

      return `
        <div class="command-card">

          <div class="command-title">

            <div class="command-name">
              ${playing ? "▶ NOW PLAYING" : `#${game.position}`}
              //
              ${escapeHtml(game.game_name)}
            </div>

            <span class="badge ${playing ? "status" : "kind"}">
              ${playing ? "PLAYING" : "QUEUED"}
            </span>

            <span class="badge">
              REQUEST ID:
              ${game.id}
            </span>

          </div>


          <div class="command-desc">
            REQUESTED BY:
            ${escapeHtml(game.requested_by)}
          </div>


          <div
            style="
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin-top: 12px;
            "
          >

            ${
              !playing
                ? `
                  <button
                    class="find-btn"
                    data-game-action="playing"
                    data-request-id="${game.id}"
                  >
                    ▶ PLAY
                  </button>
                `
                : ""
            }

            <button
              class="find-btn"
              data-game-action="completed"
              data-request-id="${game.id}"
            >
              ✓ COMPLETE
            </button>

            <button
              class="find-btn"
              data-game-action="removed"
              data-request-id="${game.id}"
            >
              X REMOVE
            </button>

            <button
              class="find-btn"
              data-game-action="rejected"
              data-request-id="${game.id}"
            >
              REJECT
            </button>

          </div>

        </div>
      `;
    })
    .join("");
}

async function loadAdminGames() {
  const container = document.getElementById("adminGameQueue");

  if (!container) {
    return;
  }

  container.innerHTML = "LOADING OXNET PROGRAMMING DATABASE...";

  try {
    const response = await adminFetch("/admin/games");

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const games = data.games || [];

    renderAdminGames(games);

    document.getElementById("adminGameCount").textContent =
      games.length.toLocaleString();
  } catch (error) {
    console.error("Admin game queue failed.", error);

    container.innerHTML = `
      <div class="empty">
        *** PROGRAMMING DATABASE FAILURE.
        <br><br>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

async function updateGameStatus(requestId, status) {
  const destructive = ["completed", "removed", "rejected"].includes(status);

  if (destructive) {
    const confirmed = window.confirm(
      `Set request ID ${requestId} to ${status.toUpperCase()}?`,
    );

    if (!confirmed) {
      return;
    }
  }

  try {
    const response = await adminFetch("/admin/games/status", {
      method: "POST",

      body: JSON.stringify({
        request_id: Number(requestId),

        status,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      window.alert(data.error || "OXNET rejected the update.");

      return;
    }

    await loadAdminGames();
  } catch (error) {
    console.error("Admin game update failed.", error);

    window.alert("OXNET fell down the stairs. Try again.");
  }
}

function bindGameActions() {
  const container = document.getElementById("adminGameQueue");

  if (!container) {
    return;
  }

  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-game-action]");

    if (!button) {
      return;
    }

    const requestId = button.dataset.requestId;

    const action = button.dataset.gameAction;

    updateGameStatus(requestId, action);
  });
}

function renderAdminLibrary(games) {
  const container = document.getElementById("adminGameLibrary");

  if (!container) {
    return;
  }

  if (!games.length) {
    container.innerHTML = `
      <div class="empty">
        *** GAME LIBRARY EMPTY.
        <br><br>
        OXNET PROGRAMMING HAS
        APPARENTLY SOLD THE COLLECTION.
      </div>
    `;

    return;
  }

  container.innerHTML = games
    .map((game) => {
      const completed = Boolean(game.completed_at);

      let status = "AVAILABLE";

      if (completed) {
        status = "COMPLETED";
      } else if (!game.owned) {
        status = "NOT OWNED";
      } else if (!game.enabled) {
        status = "DISABLED";
      } else if (game.request_type !== "schmeckles") {
        status = game.request_type.toUpperCase();
      }

      return `
        <div class="command-card">

          <div class="command-title">

            <div class="command-name">
              ${escapeHtml(game.game_name)}
              //
              ${escapeHtml(game.platform)}
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
            <br>

            REQUEST TYPE:
            ${escapeHtml(game.request_type)}
            <br>

            COST:
            ${Number(game.schmeckle_cost || 0).toLocaleString()}
            SCHMECKLES
            <br>

            OWNED:
            ${game.owned ? "YES" : "NO"}
            //
            ENABLED:
            ${game.enabled ? "YES" : "NO"}
          </div>

          <div class="command-example">
            &gt; !addgame
            ${escapeHtml(game.library_code)}
          </div>

        </div>
      `;
    })
    .join("");
}

async function loadAdminLibrary() {
  const container = document.getElementById("adminGameLibrary");

  if (!container) {
    return;
  }

  container.innerHTML = "LOADING OXNET GAME LIBRARY...";

  try {
    const response = await adminFetch("/admin/library");

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    renderAdminLibrary(data.games || []);
  } catch (error) {
    console.error("Admin game library failed.", error);

    container.innerHTML = `
      <div class="empty">
        *** GAME LIBRARY DATABASE FAILURE.
        <br><br>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

async function loadDashboard() {
  try {
    const response = await adminFetch("/admin/games");

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    document.getElementById("adminGameCount").textContent = Number(
      data.games?.length || 0,
    ).toLocaleString();
  } catch (error) {
    console.error("Admin dashboard failed.", error);

    document.getElementById("adminGameCount").textContent = "ERROR";
  }
}

async function verifyAdmin() {
  const session = getSession();

  if (!session) {
    showDenied("TWITCH LOGIN REQUIRED");

    return;
  }

  try {
    const response = await adminFetch("/admin/me");

    const data = await response.json();

    if (!response.ok || !data.admin) {
      if (response.status === 401) {
        localStorage.removeItem(SESSION_KEY);
      }

      showDenied("ACCESS DENIED");

      return;
    }

    showAdmin(data);

    await loadDashboard();
  } catch (error) {
    console.error("OXNET admin verification failed.", error);

    const status = document.getElementById("adminAuthStatus");

    status.textContent = "*** OXNET SECURITY SERVER UNAVAILABLE.";
  }
}

function startAdmin() {
  bindNavigation();
  bindButtons();
  bindGameActions();
  verifyAdmin();
}

startAdmin();
