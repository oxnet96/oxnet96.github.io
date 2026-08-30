import { API_URL, SESSION_KEY } from "../js/config.js";

let currentQuery = "";

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
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${getSession()}`,
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

function getApp() {
  return document.getElementById("adminEconomyApp");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value) {
  if (!value) {
    return "NEVER";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function getUserName(user) {
  return (
    user.twitch_display_name ||
    user.twitch_login ||
    user.twitch_user_id ||
    "UNKNOWN USER"
  );
}

function sortUsers(users) {
  return [...users].sort((a, b) =>
    getUserName(a).localeCompare(
      getUserName(b),
      undefined,
      {
        sensitivity: "base",
      },
    ),
  );
}

function renderDirectoryLoading() {
  const app = getApp();

  if (!app) {
    return;
  }

  app.innerHTML = `
    <div class="status-box" style="margin:0;">
      LOADING OXNET USER DIRECTORY...
    </div>
  `;
}

function renderUserGrid(users) {
  const app = getApp();

  if (!app) {
    return;
  }

  const sortedUsers = sortUsers(users);

  const cards = sortedUsers.length
    ? sortedUsers
        .map(
          (user) => `
            <button
              type="button"
              class="command-card economy-user-card"
              data-economy-open="${escapeHtml(
                user.twitch_user_id,
              )}"
            >
              <div>
                <div class="command-title">
                  <div
                    class="command-name economy-user-name"
                  >
                    ${escapeHtml(getUserName(user))}
                  </div>

                  <span class="badge cost">
                    ${formatNumber(user.schmeckles)}
                  </span>
                </div>

                <div class="economy-user-meta">
                  LOGIN:
                  ${escapeHtml(user.twitch_login)}
                  <br>

                  LAST SEEN:
                  ${escapeHtml(
                    formatDate(user.last_seen_at),
                  )}
                </div>
              </div>

              <div class="economy-open-hint">
                OPEN ACCOUNT &gt;
              </div>
            </button>
          `,
        )
        .join("")
    : `
        <div class="empty">
          *** NO OXNET USERS MATCHED THAT SEARCH.
        </div>
      `;

  app.innerHTML = `
    <div class="economy-toolbar">
      <input
        id="adminEconomySearch"
        class="search"
        type="text"
        value="${escapeHtml(currentQuery)}"
        placeholder="SEARCH TWITCH USER / ID..."
        autocomplete="off"
      >

      <button
        type="button"
        class="find-btn"
        data-economy-search
      >
        SEARCH
      </button>

      ${
        currentQuery
          ? `
            <button
              type="button"
              class="find-btn"
              data-economy-clear
            >
              CLEAR
            </button>
          `
          : ""
      }
    </div>

    <div class="economy-directory-header">
      <div class="panel-header" style="flex:1;">
        USER DIRECTORY
      </div>

      <div class="economy-count">
        SHOWING:
        ${sortedUsers.length.toLocaleString()}
      </div>
    </div>

    <div class="economy-user-grid">
      ${cards}
    </div>
  `;
}

async function loadUserDirectory(query = currentQuery) {
  currentQuery = String(query || "").trim();

  renderDirectoryLoading();

  try {
    const response = await adminFetch(
      `/admin/economy/users?search=${encodeURIComponent(
        currentQuery,
      )}`,
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `HTTP ${response.status}`,
      );
    }

    renderUserGrid(data.users || []);
  } catch (error) {
    console.error(
      "Economy user directory failed.",
      error,
    );

    const app = getApp();

    if (!app) {
      return;
    }

    app.innerHTML = `
      <div class="empty">
        *** ${escapeHtml(error.message)}
      </div>

      <div style="margin-top:8px;">
        <button
          class="find-btn"
          type="button"
          data-economy-back-users
        >
          RETRY
        </button>
      </div>
    `;
  }
}

function renderTransactions(transactions) {
  if (!transactions.length) {
    return `
      <div class="empty">
        NO SCHMECKLE TRANSACTIONS ON FILE.
      </div>
    `;
  }

  return transactions
    .map((tx) => {
      const delta = Number(tx.delta || 0);

      return `
        <div
          class="
            command-card
            economy-transaction-card
          "
        >
          <div class="command-title">
            <div class="command-name">
              ${delta >= 0 ? "+" : ""}${formatNumber(delta)}
              SCHMECKLES
            </div>

            <span class="badge">
              ${formatNumber(tx.balance_before)}
              -&gt;
              ${formatNumber(tx.balance_after)}
            </span>
          </div>

          <div
            class="
              command-desc
              economy-mini-desc
            "
          >
            ${escapeHtml(
              tx.reason ||
              "UNSPECIFIED TRANSACTION",
            )}

            <br>

            ${escapeHtml(
              tx.source ||
              "UNKNOWN SOURCE",
            )}

            //
            ${escapeHtml(
              formatDate(tx.created_at),
            )}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderGameRequests(requests) {
  if (!requests.length) {
    return `
      <div class="empty">
        NO GAME REQUEST HISTORY.
      </div>
    `;
  }

  return requests
    .map(
      (request) => `
        <div
          class="
            command-card
            economy-game-card
          "
        >
          <div class="command-title">
            <div class="command-name">
              ${escapeHtml(
                request.game_name ||
                "UNKNOWN GAME",
              )}
            </div>

            <span class="badge status">
              ${escapeHtml(
                String(
                  request.status ||
                  "UNKNOWN",
                ).toUpperCase(),
              )}
            </span>
          </div>

          <div
            class="
              command-desc
              economy-mini-desc
            "
          >
            ${escapeHtml(
              request.platform ||
              "UNKNOWN PLATFORM",
            )}

            //
            ${formatNumber(
              request.cost_paid,
            )}
            SCHMECKLES

            <br>

            REQUESTED:
            ${escapeHtml(
              formatDate(
                request.requested_at,
              ),
            )}

            ${
              request.refund_status &&
              String(
                request.refund_status,
              ).toLowerCase() !== "none"
                ? `
                  <br>
                  REFUND:
                  ${escapeHtml(
                    String(
                      request.refund_status,
                    ).toUpperCase(),
                  )}
                `
                : ""
            }
          </div>
        </div>
      `,
    )
    .join("");
}

function statTile(label, value, extraClass = "") {
  return `
    <div class="status-box economy-stat">
      <div class="economy-stat-label">
        ${escapeHtml(label)}
      </div>

      <div
        class="
          economy-stat-value
          ${extraClass}
        "
      >
        ${escapeHtml(value)}
      </div>
    </div>
  `;
}

function renderAccount(data, notice = "") {
  const app = getApp();

  if (!app) {
    return;
  }

  const user = data.user;
  const userName = getUserName(user);

  app.innerHTML = `
    <div class="economy-account-toolbar">
      <button
        type="button"
        class="find-btn"
        data-economy-back-users
      >
        &lt; USERS
      </button>

      <div
        class="
          panel-header
          economy-account-title
        "
      >
        ACCOUNT //
        ${escapeHtml(userName)}
      </div>
    </div>

    ${
      notice
        ? `
          <div
            class="
              status-box
              economy-notice
            "
            style="margin-top:0;"
          >
            ${escapeHtml(notice)}
          </div>
        `
        : ""
    }

    <div class="economy-stat-grid">
      ${statTile(
        "BALANCE",
        `${formatNumber(
          user.schmeckles,
        )} SCHMECKLES`,
        "economy-balance-value",
      )}

      ${statTile(
        "TWITCH LOGIN",
        user.twitch_login || "---",
      )}

      ${statTile(
        "TWITCH ID",
        user.twitch_user_id || "---",
      )}

      ${statTile(
        "LAST SEEN",
        formatDate(user.last_seen_at),
      )}

      ${statTile(
        "BANK SYNC",
        formatDate(user.synced_at),
      )}
    </div>

    <div
      class="
        command-card
        economy-adjustment
      "
    >
      <div class="panel-header">
        ADMIN BALANCE ADJUSTMENT
      </div>

      <div class="economy-adjust-grid">
        <label>
          AMOUNT
          <br>

          <input
            id="adminEconomyAmount"
            class="search"
            type="number"
            min="1"
            step="1"
            value="100"
          >
        </label>

        <label>
          REASON
          <br>

          <input
            id="adminEconomyReason"
            class="search"
            type="text"
            maxlength="250"
            placeholder="Manual correction, contest prize, etc."
          >
        </label>
      </div>

      <div class="economy-adjust-actions">
        <button
          type="button"
          class="find-btn"
          data-economy-adjust="give"
          data-twitch-user-id="${escapeHtml(
            user.twitch_user_id,
          )}"
        >
          + GIVE
        </button>

        <button
          type="button"
          class="find-btn"
          data-economy-adjust="take"
          data-twitch-user-id="${escapeHtml(
            user.twitch_user_id,
          )}"
        >
          - TAKE
        </button>
      </div>

      <div
        id="adminEconomyAdjustStatus"
        style="margin-top:8px;"
      ></div>
    </div>

    <div class="economy-history-grid">
      <div class="economy-history-column">
        <div class="panel-header">
          SCHMECKLE LEDGER //
          ${data.transactions.length}
        </div>

        <div class="economy-scroll">
          ${renderTransactions(
            data.transactions,
          )}
        </div>
      </div>

      <div class="economy-history-column">
        <div class="panel-header">
          GAME REQUEST HISTORY //
          ${data.game_requests.length}
        </div>

        <div class="economy-scroll">
          ${renderGameRequests(
            data.game_requests,
          )}
        </div>
      </div>
    </div>
  `;
}

async function openEconomyUser(
  twitchUserId,
  notice = "",
) {
  const app = getApp();

  if (!app) {
    return;
  }

  app.innerHTML = `
    <div class="status-box" style="margin:0;">
      OPENING OXNET ACCOUNT...
    </div>
  `;

  try {
    const response = await adminFetch(
      `/admin/economy/user?twitch_user_id=${encodeURIComponent(
        twitchUserId,
      )}`,
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `HTTP ${response.status}`,
      );
    }

    renderAccount(data, notice);
  } catch (error) {
    console.error(
      "Economy account failed.",
      error,
    );

    app.innerHTML = `
      <div class="empty">
        *** ${escapeHtml(error.message)}
      </div>

      <div style="margin-top:8px;">
        <button
          type="button"
          class="find-btn"
          data-economy-back-users
        >
          &lt; USERS
        </button>
      </div>
    `;
  }
}

async function applyAdjustment(button) {
  const twitchUserId =
    button.dataset.twitchUserId;

  const operation =
    button.dataset.economyAdjust;

  const amountInput =
    document.getElementById(
      "adminEconomyAmount",
    );

  const reasonInput =
    document.getElementById(
      "adminEconomyReason",
    );

  const status =
    document.getElementById(
      "adminEconomyAdjustStatus",
    );

  const amount = Number(
    amountInput?.value,
  );

  const reason = String(
    reasonInput?.value || "",
  ).trim();

  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    if (status) {
      status.innerHTML = `
        <div class="empty">
          *** ENTER A POSITIVE WHOLE NUMBER.
        </div>
      `;
    }

    return;
  }

  if (!reason) {
    if (status) {
      status.innerHTML = `
        <div class="empty">
          *** ADMIN REASON REQUIRED.
        </div>
      `;
    }

    return;
  }

  const delta =
    operation === "take"
      ? -amount
      : amount;

  const confirmed = window.confirm(
    [
      `${
        delta > 0 ? "GIVE" : "TAKE"
      } ${formatNumber(amount)} SCHMECKLES`,
      "",
      `REASON: ${reason}`,
    ].join("\n"),
  );

  if (!confirmed) {
    return;
  }

  button.disabled = true;

  if (status) {
    status.textContent =
      "WRITING LEDGER TRANSACTION...";
  }

  try {
    const response = await adminFetch(
      "/admin/economy/adjust",
      {
        method: "POST",
        body: JSON.stringify({
          twitch_user_id: twitchUserId,
          delta,
          reason,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `HTTP ${response.status}`,
      );
    }

    await openEconomyUser(
      twitchUserId,
      `${
        delta > 0 ? "GAVE" : "TOOK"
      } ${formatNumber(
        amount,
      )} SCHMECKLES // LEDGER UPDATED`,
    );
  } catch (error) {
    console.error(
      "Economy adjustment failed.",
      error,
    );

    if (status) {
      status.innerHTML = `
        <div class="empty">
          *** ${escapeHtml(error.message)}
        </div>
      `;
    }

    button.disabled = false;
  }
}

function bindEconomyUi() {
  const app = getApp();

  if (!app || app.dataset.bound === "true") {
    return;
  }

  app.dataset.bound = "true";

  app.addEventListener(
    "click",
    async (event) => {
      const searchButton =
        event.target.closest(
          "[data-economy-search]",
        );

      if (searchButton) {
        const search =
          document.getElementById(
            "adminEconomySearch",
          );

        await loadUserDirectory(
          search?.value || "",
        );

        return;
      }

      const clearButton =
        event.target.closest(
          "[data-economy-clear]",
        );

      if (clearButton) {
        currentQuery = "";

        await loadUserDirectory("");

        return;
      }

      const backButton =
        event.target.closest(
          "[data-economy-back-users]",
        );

      if (backButton) {
        await loadUserDirectory(
          currentQuery,
        );

        return;
      }

      const userCard =
        event.target.closest(
          "[data-economy-open]",
        );

      if (userCard) {
        await openEconomyUser(
          userCard.dataset.economyOpen,
        );

        return;
      }

      const adjustment =
        event.target.closest(
          "[data-economy-adjust]",
        );

      if (adjustment) {
        await applyAdjustment(
          adjustment,
        );
      }
    },
  );

  app.addEventListener(
    "keydown",
    async (event) => {
      if (
        event.key === "Enter" &&
        event.target?.id ===
          "adminEconomySearch"
      ) {
        event.preventDefault();

        await loadUserDirectory(
          event.target.value,
        );
      }
    },
  );
}

export async function loadAdminEconomy() {
  bindEconomyUi();

  await loadUserDirectory(
    currentQuery,
  );
}
