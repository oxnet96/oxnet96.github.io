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

  /*
    ================================================
    BUILD PLATFORM COUNTS
    ================================================
  */

  const platformMap = new Map();

  games.forEach((game) => {
    const platform = String(game.platform || "UNKNOWN").toUpperCase();

    if (!platformMap.has(platform)) {
      platformMap.set(platform, 0);
    }

    platformMap.set(platform, platformMap.get(platform) + 1);
  });

  const platforms = Array.from(platformMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  /*
    ================================================
    PLATFORM SELECTOR
    ================================================
  */

  container.innerHTML = `

    <div
      class="status-box"
      style="
        margin-top: 0;
        margin-bottom: 12px;
      "
    >
      SELECT PLATFORM
      <br>
      TOTAL LIBRARY:
      ${games.length.toLocaleString()}
      TITLES
    </div>

    <div
  style="
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
    margin-bottom: 12px;
  "
>
  <button
    class="find-btn"
    id="adminBulkImportBtn"
  >
    BULK IMPORT
  </button>

  <button
    class="find-btn"
    id="adminAddGameBtn"
  >
    + ADD GAME
  </button>
</div>


    <div
      style="
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(150px, 1fr)
          );
        gap: 8px;
      "
    >

      <button
        class="find-btn"
        data-library-platform="ALL"
        style="
          min-height: 70px;
          font-family:
            'Courier New',
            monospace;
        "
      >
        ALL GAMES
        <br>
        [${games.length}]
      </button>


      ${platforms
        .map(
          ([platform, count], index) => `
              <button
                class="find-btn"
                data-library-platform-index="${index}"
                style="
                  min-height: 70px;
                  font-family:
                    'Courier New',
                    monospace;
                "
              >
                ${escapeHtml(platform)}
                <br>
                [${count}]
              </button>
            `,
        )
        .join("")}

    </div>
  `;

  /*
    ALL GAMES
  */

  const allButton = container.querySelector('[data-library-platform="ALL"]');

  if (allButton) {
    allButton.addEventListener("click", () => {
      renderAdminPlatformLibrary(games, null);
    });
  }

  /*
    INDIVIDUAL PLATFORM BUTTONS
  */

  container
    .querySelectorAll("[data-library-platform-index]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.libraryPlatformIndex);

        const platform = platforms[index]?.[0];

        if (!platform) {
          return;
        }

        renderAdminPlatformLibrary(games, platform);
      });
    });
  
  const bulkImportBtn = document.getElementById("adminBulkImportBtn");

  if (bulkImportBtn) {
    bulkImportBtn.addEventListener("click", () => {
      renderAdminBulkImport(games);
    });
  }

  const addGameBtn = document.getElementById("adminAddGameBtn");

  if (addGameBtn) {
    addGameBtn.addEventListener("click", () => {
      renderAdminAddGameForm(games);
    });
  }
}

function renderAdminAddGameForm(games) {
  const container = document.getElementById("adminGameLibrary");

  if (!container) {
    return;
  }

  const platforms = Array.from(
    new Set(
      games.map((game) =>
        String(game.platform || "")
          .trim()
          .toUpperCase(),
      ),
    ),
  )
    .filter(Boolean)
    .sort();

  container.innerHTML = `

    <div
      style="
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      "
    >
      <button
        class="find-btn"
        id="adminAddGameCancel"
      >
        &lt; CANCEL
      </button>

      <div
        class="status-box"
        style="
          margin: 0;
          flex: 1;
          min-height: 0;
        "
      >
        ADD GAME TO OXNET LIBRARY
      </div>
    </div>


    <div
      class="command-card"
      style="
        display: grid;
        gap: 10px;
      "
    >

      <label>
        GAME TITLE
        <br>

        <input
          id="adminAddGameName"
          class="search"
          type="text"
          maxlength="120"
          placeholder="Battletoads"
        >
      </label>


      <label>
        PLATFORM
        <br>

        <input
          id="adminAddGamePlatform"
          class="search"
          type="text"
          list="adminPlatformList"
          maxlength="20"
          placeholder="NES"
        >

        <datalist id="adminPlatformList">
          ${platforms
            .map(
              (platform) => `
                  <option
                    value="${escapeHtml(platform)}"
                  ></option>
                `,
            )
            .join("")}
        </datalist>
      </label>


      <label>
        REQUEST TYPE
        <br>

        <select
          id="adminAddGameType"
          class="search"
        >
          <option value="schmeckles">
            SCHMECKLES
          </option>

          <option value="donation">
            DONATION ONLY
          </option>

          <option value="community">
            COMMUNITY CHALLENGE
          </option>

          <option value="disabled">
            DISABLED
          </option>
        </select>
      </label>


      <label>
        SCHMECKLE COST
        <br>

        <input
          id="adminAddGameCost"
          class="search"
          type="number"
          min="0"
          step="1"
          value="25000"
        >
      </label>


      <label>
        <input
          id="adminAddGameOwned"
          type="checkbox"
          checked
        >

        OWNED
      </label>


      <label>
        <input
          id="adminAddGameEnabled"
          type="checkbox"
          checked
        >

        ENABLED
      </label>


      <label>
        NOTES
        <br>

        <textarea
          id="adminAddGameNotes"
          class="search"
          rows="4"
          maxlength="1000"
          placeholder="Optional admin notes..."
        ></textarea>
      </label>


      <button
        class="find-btn"
        id="adminAddGameSave"
        style="
          min-height: 44px;
        "
      >
        SAVE GAME
      </button>


      <div
        id="adminAddGameStatus"
      ></div>

    </div>
  `;

  document
    .getElementById("adminAddGameCancel")
    .addEventListener("click", () => {
      renderAdminLibrary(games);
    });

  document
    .getElementById("adminAddGameSave")
    .addEventListener("click", async () => {
      const status = document.getElementById("adminAddGameStatus");

      const gameName = document.getElementById("adminAddGameName").value.trim();

      const platform = document
        .getElementById("adminAddGamePlatform")
        .value.trim()
        .toUpperCase();

      const requestType = document.getElementById("adminAddGameType").value;

      const schmeckleCost = Number(
        document.getElementById("adminAddGameCost").value,
      );

      const owned = document.getElementById("adminAddGameOwned").checked;

      const enabled = document.getElementById("adminAddGameEnabled").checked;

      const notes = document.getElementById("adminAddGameNotes").value.trim();

      if (!gameName || !platform) {
        status.innerHTML = `
            <div class="empty">
              *** TITLE AND PLATFORM REQUIRED.
            </div>
          `;

        return;
      }

      status.textContent = "SAVING TO OXNET DATABASE...";

      try {
        const response = await adminFetch("/admin/library/add", {
          method: "POST",

          body: JSON.stringify({
            game_name: gameName,

            platform,

            owned,

            enabled,

            request_type: requestType,

            schmeckle_cost: schmeckleCost,

            notes,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        window.alert(
          `${data.game.game_name} (${data.game.platform}) added as ${data.game.library_code}.`,
        );

        await loadAdminLibrary();
      } catch (error) {
        console.error("Admin add game failed.", error);

        status.innerHTML = `
            <div class="empty">
              *** ${escapeHtml(error.message)}
            </div>
          `;
      }
    });
}

function renderAdminBulkImport(games) {
  const container = document.getElementById("adminGameLibrary");

  if (!container) {
    return;
  }

  let parsedGames = [];

  container.innerHTML = `

    <div
      style="
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      "
    >
      <button
        class="find-btn"
        id="adminBulkCancel"
      >
        &lt; CANCEL
      </button>

      <div
        class="status-box"
        style="
          margin: 0;
          flex: 1;
          min-height: 0;
        "
      >
        OXNET GAME LIBRARY //
        BULK IMPORT
      </div>
    </div>


    <div
      class="command-card"
      style="
        display: grid;
        gap: 12px;
      "
    >

      <div class="command-desc">
        UPLOAD A CSV OR PASTE CSV DATA BELOW.
        <br><br>
        REQUIRED:
        <b>GAME NAME</b> + <b>PLATFORM/CONSOLE</b>
        <br>
        EVERYTHING ELSE CAN USE DEFAULTS.
      </div>


      <div class="command-example">
        game_name,platform,request_type,schmeckle_cost,owned,enabled
        <br>
        Super Metroid,SNES,schmeckles,25000,true,true
      </div>


      <label>
        CSV FILE
        <br>

        <input
          id="adminBulkFile"
          class="search"
          type="file"
          accept=".csv,text/csv"
        >
      </label>


      <label>
        OR PASTE CSV
        <br>

        <textarea
          id="adminBulkText"
          class="search"
          rows="12"
          placeholder="game_name,platform&#10;Super Mario Bros.,NES&#10;Sonic the Hedgehog,GENESIS"
        ></textarea>
      </label>


      <button
        class="find-btn"
        id="adminBulkPreviewBtn"
        style="
          min-height: 44px;
        "
      >
        PREVIEW IMPORT
      </button>


      <div
        id="adminBulkStatus"
      ></div>


      <div
        id="adminBulkPreview"
      ></div>


      <button
        class="find-btn"
        id="adminBulkImportSave"
        style="
          min-height: 44px;
          display: none;
        "
      >
        IMPORT GAMES
      </button>

    </div>
  `;

  const textArea = document.getElementById("adminBulkText");

  const fileInput = document.getElementById("adminBulkFile");

  const previewContainer = document.getElementById("adminBulkPreview");

  const status = document.getElementById("adminBulkStatus");

  const importButton = document.getElementById("adminBulkImportSave");

  /*
    ================================================
    CSV PARSER

    Handles:
    commas
    quoted fields
    escaped quotes
    Windows line endings
    ================================================
  */

  function parseCsv(text) {
    const rows = [];

    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      const next = text[i + 1];

      if (char === '"') {
        if (quoted && next === '"') {
          field += '"';
          i++;
        } else {
          quoted = !quoted;
        }

        continue;
      }

      if (char === "," && !quoted) {
        row.push(field);
        field = "";

        continue;
      }

      if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") {
          i++;
        }

        row.push(field);

        if (row.some((value) => String(value).trim())) {
          rows.push(row);
        }

        row = [];
        field = "";

        continue;
      }

      field += char;
    }

    row.push(field);

    if (row.some((value) => String(value).trim())) {
      rows.push(row);
    }

    return rows;
  }

  function normalizePlatformName(value) {
    const raw = String(value || "").trim();

    const key = raw.toLowerCase();

    const aliases = {
      "nintendo entertainment system": "NES",

      nes: "NES",

      "super nintendo entertainment system": "SNES",

      "super nintendo": "SNES",

      snes: "SNES",

      "nintendo 64": "N64",

      n64: "N64",

      "game boy": "GAME BOY",

      "game boy color": "GBC",

      "game boy advance": "GBA",

      "sega genesis": "GENESIS",

      genesis: "GENESIS",

      "sega mega drive": "GENESIS",

      "mega drive": "GENESIS",

      "sega master system": "MASTER SYSTEM",

      "sega saturn": "SATURN",

      saturn: "SATURN",

      "sega dreamcast": "DREAMCAST",

      dreamcast: "DREAMCAST",

      "sony playstation": "PS1",

      playstation: "PS1",

      "playstation 1": "PS1",

      ps1: "PS1",

      psx: "PS1",

      "turbografx-16": "TG16",

      "turbografx 16": "TG16",

      "pc engine": "TG16",

      "neo geo": "NEO GEO",

      msx: "MSX",
    };

    return aliases[key] || raw.toUpperCase();
  }

  function normalizeHeader(value) {
    return String(value || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function findColumn(headers, aliases) {
    for (const alias of aliases) {
      const index = headers.indexOf(alias);

      if (index !== -1) {
        return index;
      }
    }

    return -1;
  }

  function parseBoolean(value, defaultValue) {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();

    if (!normalized) {
      return defaultValue;
    }

    if (["true", "yes", "y", "1"].includes(normalized)) {
      return true;
    }

    if (["false", "no", "n", "0"].includes(normalized)) {
      return false;
    }

    return defaultValue;
  }

  /*
    ================================================
    CONVERT CSV → OXNET GAMES
    ================================================
  */

  function parseImportText(text) {
    const rows = parseCsv(text);

    if (rows.length < 2) {
      throw new Error("CSV needs a header row and at least one game.");
    }

    const headers = rows[0].map(normalizeHeader);

    /*
      Supports both our preferred format and
      ordinary ROM inventory CSV names such as:

      Game Name
      Console
    */

    const gameNameIndex = findColumn(headers, [
      "game_name",
      "game",
      "game_title",
      "title",
      "name",
    ]);

    const platformIndex = findColumn(headers, [
      "platform",
      "console",
      "system",
    ]);

    const requestTypeIndex = findColumn(headers, ["request_type", "type"]);

    const costIndex = findColumn(headers, ["schmeckle_cost", "cost", "price"]);

    const ownedIndex = findColumn(headers, ["owned"]);

    const enabledIndex = findColumn(headers, ["enabled"]);

    const notesIndex = findColumn(headers, ["notes"]);

    if (gameNameIndex === -1) {
      throw new Error("Could not find GAME NAME column.");
    }

    if (platformIndex === -1) {
      throw new Error("Could not find PLATFORM or CONSOLE column.");
    }

    const output = [];

    const errors = [];

    rows.slice(1).forEach((row, index) => {
      const gameName = String(row[gameNameIndex] || "").trim();

      const platform = normalizePlatformName(row[platformIndex]);

      if (!gameName || !platform) {
        errors.push(`Row ${index + 2}: missing game name or platform`);

        return;
      }

      const requestType =
        requestTypeIndex !== -1
          ? String(row[requestTypeIndex] || "schmeckles")
              .trim()
              .toLowerCase()
          : "schmeckles";

      let schmeckleCost = costIndex !== -1 ? Number(row[costIndex]) : 25000;

      if (!Number.isInteger(schmeckleCost) || schmeckleCost < 0) {
        schmeckleCost = 25000;
      }

      output.push({
        game_name: gameName,

        platform,

        request_type: requestType,

        schmeckle_cost: schmeckleCost,

        owned: ownedIndex !== -1 ? parseBoolean(row[ownedIndex], true) : true,

        enabled:
          enabledIndex !== -1 ? parseBoolean(row[enabledIndex], true) : true,

        notes: notesIndex !== -1 ? String(row[notesIndex] || "").trim() : "",
      });
    });

    if (errors.length) {
      console.warn("OXNET import skipped bad rows:", errors);
    }

    return {
      games: output,
      skippedRows: errors.length,
    };
  }

  /*
    ================================================
    PREVIEW
    ================================================
  */

  function buildPreview() {
    status.innerHTML = "";
    previewContainer.innerHTML = "";
    importButton.style.display = "none";

    parsedGames = [];

    try {
      const parsed = parseImportText(textArea.value);

      parsedGames = parsed.games;

      if (!parsedGames.length) {
        throw new Error("No valid games found.");
      }

      if (parsedGames.length > 90000) {
        throw new Error(
          "OXNET currently supports a maximum of 90,000 G##### library codes.",
        );
      }

      const platformCounts = new Map();

      parsedGames.forEach((game) => {
        platformCounts.set(
          game.platform,
          (platformCounts.get(game.platform) || 0) + 1,
        );
      });

      const platformSummary = Array.from(platformCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(
          ([platform, count]) =>
            `${escapeHtml(platform)}: ${count.toLocaleString()}`,
        )
        .join("<br>");

      status.innerHTML = `
        <div
          class="status-box"
          style="
            margin: 0;
            min-height: 0;
          "
        >
          VALID GAMES:
          ${parsedGames.length.toLocaleString()}
          <br>

          BAD ROWS SKIPPED:
          ${parsed.skippedRows.toLocaleString()}

          <br><br>

          ${platformSummary}
        </div>
      `;

      /*
        Only preview first 50 so a
        5,000-game library doesn't
        murder the browser.
      */

      previewContainer.innerHTML =
        `
          <div class="panel-header">
            IMPORT PREVIEW //
            FIRST
            ${Math.min(parsedGames.length, 50)}
            TITLES
          </div>
        ` +
        parsedGames
          .slice(0, 50)
          .map(
            (game) => `
              <div class="command-card">

                <div class="command-title">

                  <div class="command-name">
                    ${escapeHtml(game.game_name)}
                  </div>

                  <span class="badge">
                    ${escapeHtml(game.platform)}
                  </span>

                </div>

                <div class="command-desc">
                  ${escapeHtml(game.request_type)}
                  //
                  ${Number(game.schmeckle_cost).toLocaleString()}
                  SCHMECKLES
                </div>

              </div>
            `,
          )
          .join("");

      importButton.style.display = "block";
    } catch (error) {
      status.innerHTML = `
        <div class="empty">
          *** ${escapeHtml(error.message)}
        </div>
      `;
    }
  }

  /*
    ================================================
    FILE UPLOAD
    ================================================
  */

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];

    if (!file) {
      return;
    }

    try {
      textArea.value = await file.text();

      buildPreview();
    } catch (error) {
      status.innerHTML = `
          <div class="empty">
            *** UNABLE TO READ CSV FILE.
          </div>
        `;
    }
  });

  /*
    ================================================
    BUTTONS
    ================================================
  */

  document
    .getElementById("adminBulkPreviewBtn")
    .addEventListener("click", buildPreview);

  document.getElementById("adminBulkCancel").addEventListener("click", () => {
    renderAdminLibrary(games);
  });

  /*
    ================================================
    IMPORT

    Backend accepts max 2,000 per
    request, so large libraries are
    automatically sent in batches.
    ================================================
  */

  importButton.addEventListener("click", async () => {
    if (!parsedGames.length) {
      return;
    }

    const confirmed = window.confirm(
      `Import ${parsedGames.length.toLocaleString()} games into OXNET?`,
    );

    if (!confirmed) {
      return;
    }

    importButton.disabled = true;

    let imported = 0;
    let skipped = 0;

    try {
      for (let start = 0; start < parsedGames.length; start += 2000) {
        const batch = parsedGames.slice(start, start + 2000);

        status.innerHTML = `
            <div
              class="status-box"
              style="
                margin: 0;
                min-height: 0;
              "
            >
              IMPORTING...
              <br>
              PROCESSED:
              ${Math.min(start, parsedGames.length).toLocaleString()}
              /
              ${parsedGames.length.toLocaleString()}
            </div>
          `;

        const response = await adminFetch("/admin/library/bulk", {
          method: "POST",

          body: JSON.stringify({
            games: batch,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const details = Array.isArray(data.errors)
            ? data.errors.join("\n")
            : "";

          throw new Error(
            [data.error || `HTTP ${response.status}`, details]
              .filter(Boolean)
              .join("\n"),
          );
        }

        imported += Number(data.imported || 0);

        skipped += Number(data.skipped || 0);
      }

      window.alert(
        [
          "OXNET BULK IMPORT COMPLETE",
          "",
          `Imported: ${imported.toLocaleString()}`,
          `Already existed / skipped: ${skipped.toLocaleString()}`,
        ].join("\n"),
      );

      await loadAdminLibrary();
    } catch (error) {
      console.error("OXNET bulk import failed.", error);

      status.innerHTML = `
          <div class="empty">
            *** BULK IMPORT FAILED.
            <br><br>
            ${escapeHtml(error.message)}
          </div>
        `;

      importButton.disabled = false;
    }
  });
}

function renderAdminEditGameForm(games, game) {
  const container = document.getElementById("adminGameLibrary");

  if (!container) {
    return;
  }

  const platforms = Array.from(
    new Set(
      games.map((item) =>
        String(item.platform || "")
          .trim()
          .toUpperCase(),
      ),
    ),
  )
    .filter(Boolean)
    .sort();

  container.innerHTML = `

    <div
      style="
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      "
    >
      <button
        class="find-btn"
        id="adminEditGameCancel"
      >
        &lt; CANCEL
      </button>

      <div
        class="status-box"
        style="
          margin: 0;
          flex: 1;
          min-height: 0;
        "
      >
        EDIT GAME //
        ${escapeHtml(game.library_code)}
      </div>
    </div>


    <div
      class="command-card"
      style="
        display: grid;
        gap: 10px;
      "
    >

      <label>
        LIBRARY CODE
        <br>

        <input
          class="search"
          type="text"
          value="${escapeHtml(game.library_code)}"
          disabled
        >
      </label>


      <label>
        GAME TITLE
        <br>

        <input
          id="adminEditGameName"
          class="search"
          type="text"
          maxlength="120"
          value="${escapeHtml(game.game_name)}"
        >
      </label>


      <label>
        PLATFORM
        <br>

        <input
          id="adminEditGamePlatform"
          class="search"
          type="text"
          list="adminEditPlatformList"
          maxlength="20"
          value="${escapeHtml(game.platform)}"
        >

        <datalist
          id="adminEditPlatformList"
        >
          ${platforms
            .map(
              (platform) => `
                <option
                  value="${escapeHtml(platform)}"
                ></option>
              `,
            )
            .join("")}
        </datalist>
      </label>


      <label>
        REQUEST TYPE
        <br>

        <select
          id="adminEditGameType"
          class="search"
        >
          <option
            value="schmeckles"
            ${game.request_type === "schmeckles" ? "selected" : ""}
          >
            SCHMECKLES
          </option>

          <option
            value="donation"
            ${game.request_type === "donation" ? "selected" : ""}
          >
            DONATION ONLY
          </option>

          <option
            value="community"
            ${game.request_type === "community" ? "selected" : ""}
          >
            COMMUNITY CHALLENGE
          </option>

          <option
            value="disabled"
            ${game.request_type === "disabled" ? "selected" : ""}
          >
            DISABLED
          </option>
        </select>
      </label>


      <label>
        SCHMECKLE COST
        <br>

        <input
          id="adminEditGameCost"
          class="search"
          type="number"
          min="0"
          step="1"
          value="${Number(game.schmeckle_cost || 0)}"
        >
      </label>


      <label>
        <input
          id="adminEditGameOwned"
          type="checkbox"
          ${game.owned ? "checked" : ""}
        >

        OWNED
      </label>


      <label>
        <input
          id="adminEditGameEnabled"
          type="checkbox"
          ${game.enabled ? "checked" : ""}
        >

        ENABLED
      </label>


      <label>
        NOTES
        <br>

        <textarea
          id="adminEditGameNotes"
          class="search"
          rows="4"
          maxlength="1000"
          placeholder="Optional admin notes..."
        >${escapeHtml(game.notes || "")}</textarea>
      </label>


      ${
        game.completed_at
          ? `
            <div
              class="status-box"
              style="
                margin: 0;
                min-height: 0;
              "
            >
              STATUS: COMPLETED
              <br>
              COMPLETED:
              ${escapeHtml(game.completed_at)}
            </div>
          `
          : ""
      }


      <button
        class="find-btn"
        id="adminEditGameSave"
        style="
          min-height: 44px;
        "
      >
        SAVE CHANGES
      </button>


      <div
        id="adminEditGameStatus"
      ></div>

    </div>
  `;

  /*
    ================================================
    CANCEL
    ================================================
  */

  document
    .getElementById("adminEditGameCancel")
    .addEventListener("click", () => {
      renderAdminPlatformLibrary(games, String(game.platform).toUpperCase());
    });

  /*
    ================================================
    SAVE
    ================================================
  */

  document
    .getElementById("adminEditGameSave")
    .addEventListener("click", async () => {
      const status = document.getElementById("adminEditGameStatus");

      const gameName = document
        .getElementById("adminEditGameName")
        .value.trim();

      const platform = document
        .getElementById("adminEditGamePlatform")
        .value.trim()
        .toUpperCase();

      const requestType = document.getElementById("adminEditGameType").value;

      const schmeckleCost = Number(
        document.getElementById("adminEditGameCost").value,
      );

      const owned = document.getElementById("adminEditGameOwned").checked;

      const enabled = document.getElementById("adminEditGameEnabled").checked;

      const notes = document.getElementById("adminEditGameNotes").value.trim();

      if (!gameName || !platform) {
        status.innerHTML = `
            <div class="empty">
              *** TITLE AND PLATFORM REQUIRED.
            </div>
          `;

        return;
      }

      if (!Number.isInteger(schmeckleCost) || schmeckleCost < 0) {
        status.innerHTML = `
            <div class="empty">
              *** INVALID SCHMECKLE COST.
            </div>
          `;

        return;
      }

      status.textContent = "UPDATING OXNET DATABASE...";

      try {
        const response = await adminFetch("/admin/library/update", {
          method: "POST",

          body: JSON.stringify({
            library_code: game.library_code,

            game_name: gameName,

            platform,

            owned,

            enabled,

            request_type: requestType,

            schmeckle_cost: schmeckleCost,

            notes,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        window.alert(`${data.game.library_code} updated.`);

        await loadAdminLibrary();
      } catch (error) {
        console.error("Admin edit game failed.", error);

        status.innerHTML = `
            <div class="empty">
              *** ${escapeHtml(error.message)}
            </div>
          `;
      }
    });
}

function renderAdminPlatformLibrary(games, platform) {
  const container = document.getElementById("adminGameLibrary");

  if (!container) {
    return;
  }

  /*
    Platform = null means ALL GAMES.
  */

  const platformGames = platform
    ? games.filter((game) => String(game.platform).toUpperCase() === platform)
    : [...games];

  const heading = platform || "ALL GAMES";

  container.innerHTML = `

    <div
      style="
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      "
    >

      <button
        class="find-btn"
        id="libraryBackBtn"
      >
        &lt; CONSOLES
      </button>

      <div
        class="status-box"
        style="
          margin: 0;
          flex: 1;
        "
      >
        ${escapeHtml(heading)}
        LIBRARY //
        ${platformGames.length}
        TITLES
      </div>

    </div>


    <div
      style="
        display: flex;
        gap: 6px;
        margin-bottom: 12px;
      "
    >

      <input
        id="adminLibrarySearch"
        type="text"
        placeholder="SEARCH GAME OR G####..."
        style="
          flex: 1;
          min-width: 180px;
          font-family:
            'Courier New',
            monospace;
        "
      >

      <button
        class="find-btn"
        id="adminLibraryClearSearch"
      >
        CLEAR
      </button>

    </div>


    <div
      id="adminLibraryGameList"
    ></div>
  `;

  const list = document.getElementById("adminLibraryGameList");

  const search = document.getElementById("adminLibrarySearch");

  /*
    ================================================
    RENDER GAME RESULTS
    ================================================
  */

  function renderResults(query = "") {
    const searchText = String(query).trim().toLowerCase();

    const filtered = platformGames.filter((game) => {
      if (!searchText) {
        return true;
      }

      return (
        String(game.game_name || "")
          .toLowerCase()
          .includes(searchText) ||
        String(game.library_code || "")
          .toLowerCase()
          .includes(searchText)
      );
    });

    if (!filtered.length) {
      list.innerHTML = `
        <div class="empty">
          *** NO MATCHING SOFTWARE FOUND.
        </div>
      `;

      return;
    }

    list.innerHTML = filtered
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
          status = String(game.request_type).toUpperCase();
        }

        return `
            <div class="command-card">

              <div class="command-title">

                <div class="command-name">
                  ${escapeHtml(game.game_name)}
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

              </div>


              <div class="command-example">
                &gt;
                !addgame
                ${escapeHtml(game.library_code)}
              </div>

              <div
  style="
    margin-top: 8px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  "
>
  <button
    class="find-btn"
    data-library-edit="${escapeHtml(game.library_code)}"
  >
    EDIT GAME
  </button>
</div>

            </div>
          `;
      })
      .join("");
  }

  renderResults();

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-library-edit]");

    if (!button) {
      return;
    }

    const libraryCode = button.dataset.libraryEdit;

    const game = games.find((item) => item.library_code === libraryCode);

    if (!game) {
      return;
    }

    renderAdminEditGameForm(games, game);
  });

  /*
    ================================================
    SEARCH
    ================================================
  */

  search.addEventListener("input", () => {
    renderResults(search.value);
  });

  /*
    ================================================
    CLEAR SEARCH
    ================================================
  */

  document
    .getElementById("adminLibraryClearSearch")
    .addEventListener("click", () => {
      search.value = "";

      renderResults();

      search.focus();
    });

  /*
    ================================================
    BACK TO PLATFORM SELECTOR
    ================================================
  */

  document.getElementById("libraryBackBtn").addEventListener("click", () => {
    renderAdminLibrary(games);
  });
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

