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

function renderUserRows(users) {
  if (!users.length) {
    return `
      <div class="empty">
        *** NO OXNET USERS MATCHED THAT SEARCH.
      </div>
    `;
  }

  return users
    .map(
      (user) => `
        <div class="command-card">
          <div class="command-title">
            <div class="command-name">
              ${escapeHtml(
                user.twitch_display_name ||
                user.twitch_login
              )}
            </div>

            <span class="badge cost">
              ${formatNumber(user.schmeckles)}
              SCHMECKLES
            </span>
          </div>

          <div class="command-desc">
            LOGIN:
            ${escapeHtml(user.twitch_login)}
            <br>

            TWITCH ID:
            ${escapeHtml(user.twitch_user_id)}
            <br>

            LAST SEEN:
            ${escapeHtml(formatDate(user.last_seen_at))}
          </div>

          <div style="margin-top:10px;">
            <button
              class="find-btn"
              data-economy-open="${escapeHtml(
                user.twitch_user_id
              )}"
            >
              OPEN ACCOUNT
            </button>
          </div>
        </div>
      `,
    )
    .join("");
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
        <div class="command-card">
          <div class="command-title">
            <div class="command-name">
              ${delta >= 0 ? "+" : ""}${formatNumber(delta)}
              SCHMECKLES
            </div>

            <span class="badge">
              ${formatNumber(tx.balance_before)}
              →
              ${formatNumber(tx.balance_after)}
            </span>
          </div>

          <div class="command-desc">
            REASON:
            ${escapeHtml(tx.reason || "UNSPECIFIED")}
            <br>

            SOURCE:
            ${escapeHtml(tx.source || "UNKNOWN")}
            <br>

            TIME:
            ${escapeHtml(formatDate(tx.created_at))}
            <br>

            TX:
            ${escapeHtml(tx.transaction_id)}
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
        <div class="command-card">
          <div class="command-title">
            <div class="command-name">
              ${escapeHtml(request.game_name)}
            </div>

            <span class="badge status">
              ${escapeHtml(
                String(request.status || "UNKNOWN").toUpperCase()
              )}
            </span>
          </div>

          <div class="command-desc">
            PLATFORM:
            ${escapeHtml(request.platform || "UNKNOWN")}
            <br>

            REQUEST CODE:
            ${escapeHtml(request.request_code ?? "---")}
            <br>

            COST:
            ${formatNumber(request.cost_paid)}
            SCHMECKLES
            <br>

            REFUND:
            ${escapeHtml(
              String(
                request.refund_status || "NONE"
              ).toUpperCase()
            )}
            <br>

            REQUESTED:
            ${escapeHtml(
              formatDate(request.requested_at)
            )}
          </div>
        </div>
      `,
    )
    .join("");
}

function renderUserDetail(data) {
  const container =
    document.getElementById("adminEconomyDetail");

  if (!container) {
    return;
  }

  const user = data.user;

  container.innerHTML = `
    <div class="command-card">
      <div class="panel-header">
        ACCOUNT //
        ${escapeHtml(
          user.twitch_display_name ||
          user.twitch_login
        )}
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(180px,1fr));
          gap:8px;
          margin-top:10px;
        "
      >
        <div class="status-box" style="margin:0;">
          BALANCE
          <br>
          <strong style="font-size:22px;">
            ${formatNumber(user.schmeckles)}
          </strong>
          SCHMECKLES
        </div>

        <div class="status-box" style="margin:0;">
          TWITCH LOGIN
          <br>
          ${escapeHtml(user.twitch_login)}
        </div>

        <div class="status-box" style="margin:0;">
          TWITCH ID
          <br>
          ${escapeHtml(user.twitch_user_id)}
        </div>

        <div class="status-box" style="margin:0;">
          LAST SEEN
          <br>
          ${escapeHtml(formatDate(user.last_seen_at))}
        </div>

        <div class="status-box" style="margin:0;">
          BANK SYNC
          <br>
          ${escapeHtml(formatDate(user.synced_at))}
        </div>
      </div>

      <div
        style="
          margin-top:12px;
          padding-top:12px;
          border-top:1px solid #808080;
        "
      >
        <div class="panel-header">
          ADMIN BALANCE ADJUSTMENT
        </div>

        <div
          style="
            display:grid;
            grid-template-columns:
              minmax(120px,180px) 1fr;
            gap:8px;
            margin-top:10px;
          "
        >
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

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:8px;
            margin-top:10px;
          "
        >
          <button
            class="find-btn"
            data-economy-adjust="give"
            data-twitch-user-id="${escapeHtml(
              user.twitch_user_id
            )}"
          >
            + GIVE
          </button>

          <button
            class="find-btn"
            data-economy-adjust="take"
            data-twitch-user-id="${escapeHtml(
              user.twitch_user_id
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
    </div>

    <div style="margin-top:12px;">
      <div class="panel-header">
        SCHMECKLE LEDGER //
        ${data.transactions.length} MOST RECENT
      </div>

      <div style="margin-top:8px;">
        ${renderTransactions(data.transactions)}
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="panel-header">
        GAME REQUEST HISTORY //
        ${data.game_requests.length} MOST RECENT
      </div>

      <div style="margin-top:8px;">
        ${renderGameRequests(data.game_requests)}
      </div>
    </div>
  `;
}

async function openEconomyUser(twitchUserId) {
  const detail =
    document.getElementById("adminEconomyDetail");

  if (!detail) {
    return;
  }

  detail.innerHTML = `
    <div class="status-box">
      LOADING OXNET ACCOUNT...
    </div>
  `;

  try {
    const response = await adminFetch(
      `/admin/economy/user?twitch_user_id=${encodeURIComponent(
        twitchUserId
      )}`,
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `HTTP ${response.status}`,
      );
    }

    renderUserDetail(data);
  } catch (error) {
    console.error(
      "Economy user detail failed.",
      error,
    );

    detail.innerHTML = `
      <div class="empty">
        *** ${escapeHtml(error.message)}
      </div>
    `;
  }
}

async function searchEconomyUsers(query = "") {
  const results =
    document.getElementById("adminEconomyResults");

  if (!results) {
    return;
  }

  results.innerHTML = `
    <div class="status-box">
      SEARCHING OXNET BANK...
    </div>
  `;

  try {
    const response = await adminFetch(
      `/admin/economy/users?search=${encodeURIComponent(
        query
      )}`,
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `HTTP ${response.status}`,
      );
    }

    results.innerHTML = renderUserRows(
      data.users || [],
    );
  } catch (error) {
    console.error(
      "Economy search failed.",
      error,
    );

    results.innerHTML = `
      <div class="empty">
        *** ${escapeHtml(error.message)}
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

  const amount = Number(amountInput?.value);
  const reason = String(
    reasonInput?.value || "",
  ).trim();

  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    status.innerHTML = `
      <div class="empty">
        *** ENTER A POSITIVE WHOLE NUMBER.
      </div>
    `;
    return;
  }

  if (!reason) {
    status.innerHTML = `
      <div class="empty">
        *** ADMIN REASON REQUIRED.
      </div>
    `;
    return;
  }

  const delta =
    operation === "take"
      ? -amount
      : amount;

  const confirmed = window.confirm(
    `${
      delta > 0 ? "GIVE" : "TAKE"
    } ${formatNumber(amount)} SCHMECKLES ${
      delta > 0 ? "TO" : "FROM"
    } THIS ACCOUNT?\n\nREASON: ${reason}`,
  );

  if (!confirmed) {
    return;
  }

  button.disabled = true;

  status.textContent =
    "WRITING LEDGER TRANSACTION...";

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

    await openEconomyUser(twitchUserId);

    await searchEconomyUsers(
      document.getElementById(
        "adminEconomySearch",
      )?.value || "",
    );
  } catch (error) {
    console.error(
      "Economy adjustment failed.",
      error,
    );

    status.innerHTML = `
      <div class="empty">
        *** ${escapeHtml(error.message)}
      </div>
    `;

    button.disabled = false;
  }
}

function bindEconomyUi() {
  const search =
    document.getElementById("adminEconomySearch");

  const searchButton =
    document.getElementById(
      "adminEconomySearchBtn",
    );

  const results =
    document.getElementById(
      "adminEconomyResults",
    );

  const detail =
    document.getElementById(
      "adminEconomyDetail",
    );

  if (
    !search ||
    !searchButton ||
    !results ||
    !detail
  ) {
    return;
  }

  searchButton.addEventListener(
    "click",
    () => {
      searchEconomyUsers(search.value);
    },
  );

  search.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        searchEconomyUsers(search.value);
      }
    },
  );

  results.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(
        "[data-economy-open]",
      );

      if (!button) {
        return;
      }

      openEconomyUser(
        button.dataset.economyOpen,
      );
    },
  );

  detail.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(
        "[data-economy-adjust]",
      );

      if (!button) {
        return;
      }

      applyAdjustment(button);
    },
  );
}

let economyBound = false;

export async function loadAdminEconomy() {
  if (!economyBound) {
    bindEconomyUi();
    economyBound = true;
  }

  await searchEconomyUsers("");
}