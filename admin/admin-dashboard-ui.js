import {
  API_URL,
  SESSION_KEY
} from "../js/config.js";

function getSession () {
  return localStorage.getItem(
    SESSION_KEY
  );
}

function escapeHtml (value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function adminFetch (
  path,
  options = {}
) {
  const headers = {
    ...(options.headers || {}),
    Authorization:
      `Bearer ${getSession()}`
  };

  return fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers,
      cache: "no-store"
    }
  );
}

function formatNumber (value) {
  return Number(
    value || 0
  ).toLocaleString();
}

function formatDate (value) {
  if (!value) {
    return "---";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleString();
}

function getDashboard () {
  return document.getElementById(
    "adminDashboardApp"
  );
}

function metricCard (
  label,
  value
) {
  return `
    <div
      class="
        status-box
        dash-metric
      "
    >
      <div
        class="dash-metric-label"
      >
        ${escapeHtml(label)}
      </div>

      <div
        class="dash-metric-value"
      >
        ${escapeHtml(value)}
      </div>
    </div>
  `;
}

function renderGames (games) {
  if (!games.length) {
    return `
      <div class="empty">
        *** GAME QUEUE EMPTY.
      </div>
    `;
  }

  return games
    .slice(0, 5)
    .map(
      game => `
        <div
          class="
            command-card
            dash-card
          "
        >
          <div
            class="dash-card-title"
          >
            <div
              class="dash-card-name"
            >
              ${
                game.status === "playing"
                  ? "▶ "
                  : `#${game.position} `
              }

              ${escapeHtml(
                game.game_name
              )}
            </div>

            <span
              class="badge status"
            >
              ${escapeHtml(
                String(
                  game.status ||
                  "QUEUED"
                ).toUpperCase()
              )}
            </span>
          </div>

          <div
            class="dash-card-meta"
          >
            ${escapeHtml(
              game.platform ||
              "UNKNOWN"
            )}

            //

            ${escapeHtml(
              game.requested_by ||
              "UNKNOWN VIEWER"
            )}

            ${
              Number(
                game.cost_paid || 0
              ) > 0
                ? `
                  //
                  ${formatNumber(
                    game.cost_paid
                  )}
                  SCHMECKLES
                `
                : ""
            }
          </div>
        </div>
      `
    )
    .join("");
}

function renderSubmissions (
  submissions
) {
  if (!submissions.length) {
    return `
      <div class="empty">
        *** NO PENDING SUBMISSIONS.
      </div>
    `;
  }

  const newest = [
    ...submissions
  ]
    .sort(
      (a, b) =>
        new Date(
          b.submitted_at
        ).getTime() -
        new Date(
          a.submitted_at
        ).getTime()
    )
    .slice(0, 4);

  return newest
    .map(
      item => `
        <div
          class="
            command-card
            dash-card
          "
        >
          <div
            class="dash-card-title"
          >
            <div
              class="dash-card-name"
            >
              ${escapeHtml(
                item.title ||
                "UNTITLED INTERNET NONSENSE"
              )}
            </div>

            <span
              class="badge cost"
            >
              ${formatNumber(
                item.cost || 0
              )}
            </span>
          </div>

          <div
            class="dash-card-meta"
          >
            ${escapeHtml(
              item.twitch_display_name ||
              item.twitch_login ||
              "UNKNOWN VIEWER"
            )}

            //

            ${formatNumber(
              item.duration_seconds || 0
            )}
            SEC

            <br>

            ${escapeHtml(
              formatDate(
                item.submitted_at
              )
            )}
          </div>
        </div>
      `
    )
    .join("");
}

function renderTransactions (
  transactions
) {
  if (!transactions.length) {
    return `
      <div
        class="
          empty
          dash-empty
        "
      >
        NO ECONOMY ACTIVITY YET.
      </div>
    `;
  }

  return transactions
    .slice(0, 9)
    .map(
      tx => {
        const delta =
          Number(
            tx.delta || 0
          );

        const user =
          tx.twitch_display_name ||
          tx.twitch_login ||
          tx.twitch_user_id ||
          "UNKNOWN VIEWER";

        return `
          <div
            class="
              command-card
              dash-card
            "
          >
            <div
              class="dash-card-title"
            >
              <div
                class="dash-card-name"
              >
                ${escapeHtml(user)}
              </div>

              <span
                class="badge cost"
              >
                ${
                  delta >= 0
                    ? "+"
                    : ""
                }${formatNumber(delta)}
              </span>
            </div>

            <div
              class="dash-card-meta"
            >
              ${escapeHtml(
                tx.reason ||
                "UNSPECIFIED"
              )}

              <br>

              ${escapeHtml(
                tx.source ||
                "UNKNOWN SOURCE"
              )}

              //

              BAL:
              ${formatNumber(
                tx.balance_after
              )}

              <br>

              ${escapeHtml(
                formatDate(
                  tx.created_at
                )
              )}
            </div>
          </div>
        `;
      }
    )
    .join("");
}

function jumpToAdminView (
  view
) {
  const button =
    document.querySelector(
      `.nav-btn[data-admin-view="${view}"]`
    );

  if (button) {
    button.click();
  }
}

function bindDashboard () {
  const app =
    getDashboard();

  if (
    !app ||
    app.dataset.bound === "true"
  ) {
    return;
  }

  app.dataset.bound = "true";

  app.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-dashboard-jump]"
        );

      if (!button) {
        return;
      }

      jumpToAdminView(
        button.dataset.dashboardJump
      );
    }
  );
}

function renderDashboard (
  games,
  submissions,
  economy
) {
  const app =
    getDashboard();

  if (!app) {
    return;
  }

  const adminName =
    document
      .getElementById(
        "adminUser"
      )
      ?.textContent
      ?.trim() ||
    "OXNET ADMIN";

  const playing =
    games.find(
      game =>
        game.status === "playing"
    );

  app.innerHTML = `
    <div
      class="
        status-box
        dash-status
      "
    >
      <div
        class="dash-status-info"
      >
        ADMIN:
        <b>
          ${escapeHtml(adminName)}
        </b>

        //

        API:
        <b>ONLINE</b>

        //

        NOW PLAYING:
        <b>
          ${escapeHtml(
            playing
              ? playing.game_name
              : "NOTHING"
          )}
        </b>
      </div>

      <div class="dash-quick">
        <button
          class="find-btn"
          type="button"
          data-dashboard-jump="games"
        >
          GAME QUEUE
        </button>

        <button
          class="find-btn"
          type="button"
          data-dashboard-jump="economy"
        >
          ECONOMY
        </button>

        <button
          class="find-btn"
          type="button"
          data-dashboard-jump="submissions"
        >
          SUBMISSIONS
        </button>

        <button
          class="find-btn"
          type="button"
          data-dashboard-jump="commands"
        >
          COMMANDS
        </button>
      </div>
    </div>


    <div class="dash-metrics">
      ${metricCard(
        "OXNET USERS",
        formatNumber(
          economy.user_count
        )
      )}

      ${metricCard(
        "SCHMECKLES IN CIRCULATION",
        formatNumber(
          economy.total_schmeckles
        )
      )}

      ${metricCard(
        "ACTIVE GAME QUEUE",
        formatNumber(
          games.length
        )
      )}

      ${metricCard(
        "PENDING SUBMISSIONS",
        formatNumber(
          submissions.length
        )
      )}
    </div>


    <div class="dash-work-grid">

      <div class="dash-section">
        <div
          class="dash-section-head"
        >
          <div
            class="panel-header"
          >
            PROGRAMMING //
            GAME QUEUE
          </div>

          <button
            class="find-btn"
            type="button"
            data-dashboard-jump="games"
          >
            OPEN
          </button>
        </div>

        <div class="dash-list">
          ${renderGames(games)}
        </div>
      </div>


      <div class="dash-section">
        <div
          class="dash-section-head"
        >
          <div
            class="panel-header"
          >
            VIEWER SUBMISSIONS //
            PENDING
          </div>

          <button
            class="find-btn"
            type="button"
            data-dashboard-jump="submissions"
          >
            REVIEW
          </button>
        </div>

        <div class="dash-list">
          ${renderSubmissions(
            submissions
          )}
        </div>
      </div>

    </div>


    <div class="dash-section">
      <div
        class="dash-section-head"
      >
        <div
          class="panel-header"
        >
          OXNET BANK //
          RECENT ACTIVITY
        </div>

        <button
          class="find-btn"
          type="button"
          data-dashboard-jump="economy"
        >
          OPEN BANK
        </button>
      </div>

      <div
        class="dash-economy-grid"
      >
        ${renderTransactions(
          economy.recent_transactions ||
          []
        )}
      </div>
    </div>
  `;
}

export async function loadAdminDashboard () {
  const app =
    getDashboard();

  if (!app) {
    return;
  }

  bindDashboard();

  app.innerHTML = `
    <div
      class="status-box"
      style="margin:0;"
    >
      LOADING OXNET CONTROL CENTER...
    </div>
  `;

  try {
    const [
      gameResponse,
      submissionResponse,
      economyResponse
    ] = await Promise.all([
      adminFetch(
        "/admin/games"
      ),

      adminFetch(
        "/admin/jc-video-submissions?status=pending"
      ),

      adminFetch(
        "/admin/economy/summary"
      )
    ]);

    const [
      gameData,
      submissionData,
      economyData
    ] = await Promise.all([
      gameResponse.json(),
      submissionResponse.json(),
      economyResponse.json()
    ]);

    if (!gameResponse.ok) {
      throw new Error(
        gameData.error ||
        "Unable to load game queue"
      );
    }

    if (!submissionResponse.ok) {
      throw new Error(
        submissionData.error ||
        "Unable to load submissions"
      );
    }

    if (!economyResponse.ok) {
      throw new Error(
        economyData.error ||
        "Unable to load economy"
      );
    }

    renderDashboard(
      gameData.games || [],
      submissionData.submissions || [],
      economyData
    );
  } catch (error) {
    console.error(
      "Admin dashboard failed.",
      error
    );

    app.innerHTML = `
      <div class="empty">
        *** OXNET CONTROL CENTER FAILURE.
        <br><br>
        ${escapeHtml(
          error.message
        )}
      </div>

      <div style="margin-top:8px;">
        <button
          class="find-btn"
          type="button"
          id="adminDashboardRetry"
        >
          RETRY
        </button>
      </div>
    `;

    document
      .getElementById(
        "adminDashboardRetry"
      )
      ?.addEventListener(
        "click",
        loadAdminDashboard
      );
  }
}
