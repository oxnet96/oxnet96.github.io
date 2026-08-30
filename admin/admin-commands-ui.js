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

let commandCache = [];
let commandFilter = "all";

function commandFormHtml(item = null) {
  const editing = Boolean(item);

  return `
    <div class="command-card" style="display:grid;gap:10px;margin-bottom:12px;">
      <div class="panel-header">
        ${editing ? `EDIT COMMAND // ${escapeHtml(item.command)}` : "ADD COMMAND"}
      </div>

      <label>
        COMMAND / DISPLAY NAME
        <br>
        <input
          id="adminCommandName"
          class="search"
          type="text"
          maxlength="120"
          placeholder="!example <amount>"
          value="${escapeHtml(item?.command || "")}"
        >
      </label>

      <label>
        CATEGORY
        <br>
        <select id="adminCommandCategory" class="search">
          <option value="social" ${item?.category === "social" ? "selected" : ""}>UTILITY</option>
          <option value="schmeckles" ${item?.category === "schmeckles" ? "selected" : ""}>SCHMECKLES</option>
          <option value="sfx" ${item?.category === "sfx" ? "selected" : ""}>SFX</option>
          <option value="redemption" ${item?.category === "redemption" ? "selected" : ""}>REDEMPTION</option>
        </select>
      </label>

      <label>
        TYPE
        <br>
        <select id="adminCommandKind" class="search">
          <option value="chat" ${item?.kind === "chat" ? "selected" : ""}>CHAT</option>
          <option value="chat-redemption" ${item?.kind === "chat-redemption" ? "selected" : ""}>TWITCH CHAT REDEMPTION</option>
          <option value="channel-point" ${item?.kind === "channel-point" ? "selected" : ""}>CHANNEL POINT</option>
          <option value="portal" ${item?.kind === "portal" ? "selected" : ""}>OXNET PORTAL</option>
          <option value="planned" ${item?.kind === "planned" ? "selected" : ""}>PLANNED / SYSTEM</option>
        </select>
      </label>

      <label>
        DESCRIPTION
        <br>
        <textarea
          id="adminCommandDescription"
          class="search"
          rows="4"
          maxlength="1000"
          placeholder="What does this thing do?"
        >${escapeHtml(item?.description || "")}</textarea>
      </label>

      <label>
        SCHMECKLE COST
        <br>
        <input
          id="adminCommandCost"
          class="search"
          type="number"
          min="0"
          step="1"
          value="${Number(item?.cost || 0)}"
        >
      </label>

      <label>
        COOLDOWN DISPLAY
        <br>
        <input
          id="adminCommandCooldown"
          class="search"
          type="text"
          maxlength="120"
          placeholder="15 SEC"
          value="${escapeHtml(item?.cooldown || "")}"
        >
      </label>

      <label>
        EXAMPLE
        <br>
        <input
          id="adminCommandExample"
          class="search"
          type="text"
          maxlength="250"
          placeholder="!example 100"
          value="${escapeHtml(item?.example || "")}"
        >
      </label>

      <label>
        STATUS
        <br>
        <select id="adminCommandStatus" class="search">
          <option value="available" ${item?.status === "available" ? "selected" : ""}>AVAILABLE</option>
          <option value="planned" ${item?.status === "planned" ? "selected" : ""}>COMING SOON</option>
          <option value="hidden" ${item?.status === "hidden" ? "selected" : ""}>HIDDEN</option>
        </select>
      </label>

      <label>
        <input
          id="adminCommandIsNew"
          type="checkbox"
          ${item?.isNew ? "checked" : ""}
        >
        SHOW NEW BADGE
      </label>

      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        <button class="find-btn" id="adminCommandSave">
          ${editing ? "SAVE CHANGES" : "+ ADD COMMAND"}
        </button>

        ${
          editing
            ? `
              <button class="find-btn" id="adminCommandCancel">
                CANCEL
              </button>
            `
            : ""
        }
      </div>

      <div id="adminCommandFormStatus"></div>
    </div>
  `;
}

function commandListHtml(commands) {
  if (!commands.length) {
    return `
      <div class="empty">
        *** COMMAND DATABASE EMPTY.
      </div>
    `;
  }

  return commands
    .map(
      (item) => `
        <div class="command-card">
          <div class="command-title">
            <div class="command-name">
              ${escapeHtml(item.command)}
            </div>

            <span class="badge">
              ${escapeHtml(String(item.category || "").toUpperCase())}
            </span>

            <span class="badge kind">
              ${escapeHtml(String(item.kind || "").toUpperCase())}
            </span>

            ${
              Number(item.cost || 0) > 0
                ? `
                  <span class="badge cost">
                    ${Number(item.cost).toLocaleString()} SCHMECKLES
                  </span>
                `
                : ""
            }

            ${
              item.status === "hidden"
                ? `<span class="badge planned">HIDDEN</span>`
                : item.status === "planned"
                  ? `<span class="badge planned">COMING SOON</span>`
                  : `<span class="badge status">AVAILABLE</span>`
            }

            ${
              item.isNew
                ? `<span class="badge new">NEW</span>`
                : ""
            }
          </div>

          <div class="command-desc">
            ${escapeHtml(item.description || "")}
          </div>

          ${
            item.example
              ? `
                <div class="command-example">
                  &gt; ${escapeHtml(item.example)}
                </div>
              `
              : ""
          }

          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">
            <button
              class="find-btn"
              data-command-edit="${item.id}"
            >
              EDIT
            </button>

            <button
              class="find-btn"
              data-command-delete="${item.id}"
            >
              DELETE
            </button>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderManager() {
  const container = document.getElementById("adminCommandManager");

  if (!container) {
    return;
  }

  const filterDefinitions = [
    {
      value: "all",
      label: "ALL",
      count: commandCache.length,
    },
    {
      value: "social",
      label: "UTILITY",
      count: commandCache.filter(
        (item) => item.category === "social",
      ).length,
    },
    {
      value: "schmeckles",
      label: "SCHMECKLES",
      count: commandCache.filter(
        (item) => item.category === "schmeckles",
      ).length,
    },
    {
      value: "sfx",
      label: "SFX",
      count: commandCache.filter(
        (item) => item.category === "sfx",
      ).length,
    },
    {
      value: "redemption",
      label: "REDEMPTIONS",
      count: commandCache.filter(
        (item) => item.category === "redemption",
      ).length,
    },
    {
      value: "planned",
      label: "COMING SOON",
      count: commandCache.filter(
        (item) => item.status === "planned",
      ).length,
    },
  ];

  container.innerHTML = `
    <div style="padding:12px;">
      <div
        style="
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-bottom:12px;
        "
      >
        <input
          id="adminCommandSearch"
          class="search"
          type="text"
          placeholder="SEARCH COMMANDS..."
          style="flex:1;min-width:180px;"
        >

        <button class="find-btn" id="adminCommandAddBtn">
          + ADD COMMAND
        </button>
      </div>

      <div class="status-box" style="margin-top:0;margin-bottom:8px;">
        OXNET COMMAND DATABASE //
        ${commandCache.length.toLocaleString()} RECORDS
      </div>

      <div
        id="adminCommandFilters"
        style="
          display:flex;
          flex-wrap:wrap;
          gap:6px;
          margin-bottom:12px;
        "
      >
        ${filterDefinitions
          .map(
            (filter) => `
              <button
                class="find-btn"
                data-command-filter="${filter.value}"
                ${commandFilter === filter.value ? "disabled" : ""}
              >
                ${filter.label} (${filter.count})
              </button>
            `,
          )
          .join("")}
      </div>

      <div id="adminCommandEditor"></div>
      <div id="adminCommandList"></div>
    </div>
  `;

  const list =
    document.getElementById("adminCommandList");

  const search =
    document.getElementById("adminCommandSearch");

  const editor =
    document.getElementById("adminCommandEditor");

  const filters =
    document.getElementById("adminCommandFilters");

  function renderFiltered() {
    const query = String(
      search.value || "",
    )
      .trim()
      .toLowerCase();

    const filtered = commandCache.filter((item) => {
      const matchesFilter =
        commandFilter === "all" ||
        (
          commandFilter === "planned"
            ? item.status === "planned"
            : item.category === commandFilter
        );

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        item.command,
        item.category,
        item.kind,
        item.description,
        item.example,
        item.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    list.innerHTML = commandListHtml(filtered);
  }

  function openForm(item = null) {
    editor.innerHTML = commandFormHtml(item);

    const saveBtn =
      document.getElementById("adminCommandSave");

    const cancelBtn =
      document.getElementById("adminCommandCancel");

    const statusBox =
      document.getElementById(
        "adminCommandFormStatus",
      );

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        editor.innerHTML = "";
      });
    }

    saveBtn.addEventListener("click", async () => {
      const payload = {
        command:
          document
            .getElementById("adminCommandName")
            .value.trim(),

        category:
          document.getElementById(
            "adminCommandCategory",
          ).value,

        kind:
          document.getElementById(
            "adminCommandKind",
          ).value,

        description:
          document
            .getElementById(
              "adminCommandDescription",
            )
            .value.trim(),

        cost:
          Number(
            document.getElementById(
              "adminCommandCost",
            ).value,
          ),

        cooldown:
          document
            .getElementById(
              "adminCommandCooldown",
            )
            .value.trim(),

        example:
          document
            .getElementById(
              "adminCommandExample",
            )
            .value.trim(),

        status:
          document.getElementById(
            "adminCommandStatus",
          ).value,

        isNew:
          document.getElementById(
            "adminCommandIsNew",
          ).checked,
      };

      if (item) {
        payload.id = item.id;
        payload.sort_order = item.sort_order;
      }

      if (!payload.command) {
        statusBox.innerHTML = `
          <div class="empty">
            *** COMMAND NAME REQUIRED.
          </div>
        `;
        return;
      }

      if (
        !Number.isInteger(payload.cost) ||
        payload.cost < 0
      ) {
        statusBox.innerHTML = `
          <div class="empty">
            *** INVALID SCHMECKLE COST.
          </div>
        `;
        return;
      }

      saveBtn.disabled = true;

      statusBox.textContent =
        "WRITING TO OXNET DATABASE...";

      try {
        const response = await adminFetch(
          item
            ? "/admin/commands/update"
            : "/admin/commands/add",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            `HTTP ${response.status}`,
          );
        }

        await loadAdminCommands();
      } catch (error) {
        console.error(
          "Command save failed.",
          error,
        );

        statusBox.innerHTML = `
          <div class="empty">
            *** ${escapeHtml(error.message)}
          </div>
        `;

        saveBtn.disabled = false;
      }
    });
  }

  document
    .getElementById("adminCommandAddBtn")
    .addEventListener(
      "click",
      () => openForm(),
    );

  search.addEventListener(
    "input",
    renderFiltered,
  );

  filters.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-command-filter]",
    );

    if (!button) {
      return;
    }

    commandFilter =
      button.dataset.commandFilter || "all";

    renderManager();
  });

  list.addEventListener(
    "click",
    async (event) => {
      const editButton = event.target.closest(
        "[data-command-edit]",
      );

      const deleteButton = event.target.closest(
        "[data-command-delete]",
      );

      if (editButton) {
        const id = Number(
          editButton.dataset.commandEdit,
        );

        const item = commandCache.find(
          (command) => command.id === id,
        );

        if (item) {
          openForm(item);

          editor.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }

        return;
      }

      if (deleteButton) {
        const id = Number(
          deleteButton.dataset.commandDelete,
        );

        const item = commandCache.find(
          (command) => command.id === id,
        );

        if (!item) {
          return;
        }

        const confirmed = window.confirm(
          `Delete ${item.command} from the OXNET command database?`,
        );

        if (!confirmed) {
          return;
        }

        try {
          const response = await adminFetch(
            "/admin/commands/delete",
            {
              method: "POST",
              body: JSON.stringify({ id }),
            },
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.error ||
              `HTTP ${response.status}`,
            );
          }

          await loadAdminCommands();
        } catch (error) {
          console.error(
            "Command delete failed.",
            error,
          );

          window.alert(
            error.message ||
            "Unable to delete command.",
          );
        }
      }
    },
  );

  renderFiltered();
}

export async function loadAdminCommands() {
  const container = document.getElementById("adminCommandManager");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div style="padding:12px;">
      LOADING OXNET COMMAND DATABASE...
    </div>
  `;

  try {
    const response = await adminFetch("/admin/commands");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    commandCache = Array.isArray(data.commands) ? data.commands : [];

    renderManager();
  } catch (error) {
    console.error("Admin command database failed.", error);

    container.innerHTML = `
      <div class="empty" style="margin:12px;">
        *** COMMAND DATABASE FAILURE.
        <br><br>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}
