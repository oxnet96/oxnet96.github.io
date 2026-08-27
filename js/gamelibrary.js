import { API_URL } from "./config.js";
import { escapeHtml } from "./commands.js";

function getGameStatus(game) {
  if (game.completed) {
    return "COMPLETED";
  }

  if (game.request_type === "donation") {
    return "DONATION ONLY";
  }

  if (game.request_type === "community") {
    return "COMMUNITY";
  }

  return "AVAILABLE";
}

function renderPlatformSelector(games) {
  const container = document.getElementById("gameLibraryContainer");

  if (!container) {
    return;
  }

  if (!games.length) {
    container.innerHTML = `
      <div class="empty">
        *** GAME LIBRARY EMPTY.
      </div>
    `;

    return;
  }

  const platformMap = new Map();

  games.forEach((game) => {
    const platform = String(game.platform || "UNKNOWN").toUpperCase();

    platformMap.set(platform, (platformMap.get(platform) || 0) + 1);
  });

  const platforms = Array.from(platformMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const completedCount = games.filter((game) => game.completed).length;

  container.innerHTML = `

    <div
      class="status-box"
      style="
        margin: 0 0 12px;
        min-height: 0;
      "
    >
      OXNET SOFTWARE ARCHIVE
      <br>
      ${games.length.toLocaleString()}
      TITLES ONLINE
      <br>
      ${completedCount.toLocaleString()}
      COMPLETED
      <br><br>
      SELECT CONSOLE.
    </div>


    <div
      style="
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(140px, 1fr)
          );
        gap: 8px;
      "
    >

      <button
        class="find-btn"
        data-public-platform="ALL"
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
              data-public-platform-index="${index}"
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

  const allButton = container.querySelector('[data-public-platform="ALL"]');

  if (allButton) {
    allButton.addEventListener("click", () => {
      renderPlatformLibrary(games, null);
    });
  }

  container
    .querySelectorAll("[data-public-platform-index]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.publicPlatformIndex);

        const platform = platforms[index]?.[0];

        if (!platform) {
          return;
        }

        renderPlatformLibrary(games, platform);
      });
    });
}

function renderPlatformLibrary(games, platform) {
  const container = document.getElementById("gameLibraryContainer");

  if (!container) {
    return;
  }

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
        id="publicLibraryBackBtn"
      >
        &lt; CONSOLES
      </button>

      <div
        class="status-box"
        style="
          margin: 0;
          min-height: 0;
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
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      "
    >

      <input
        id="publicLibrarySearch"
        class="search"
        type="text"
        placeholder="SEARCH GAME OR G####..."
        style="
          flex: 1;
          min-width: 180px;
        "
      >

      <button
        class="find-btn"
        id="publicLibraryClear"
      >
        CLEAR
      </button>

    </div>


    <div
      id="publicLibraryResults"
    ></div>
  `;

  const results = document.getElementById("publicLibraryResults");

  const search = document.getElementById("publicLibrarySearch");

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
      results.innerHTML = `
        <div class="empty">
          *** NO MATCHING SOFTWARE FOUND.
        </div>
      `;

      return;
    }

    results.innerHTML = filtered
      .map((game) => {
        const status = getGameStatus(game);

        const requestable =
          !game.completed && game.request_type === "schmeckles";

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

                ${
                  game.request_type === "schmeckles"
                    ? `
                      COST:
                      ${Number(game.schmeckle_cost || 0).toLocaleString()}
                      SCHMECKLES
                    `
                    : `
                      REQUEST TYPE:
                      ${escapeHtml(status)}
                    `
                }

              </div>


              ${
                requestable
                  ? `
                    <div class="command-example">
                      &gt;
                      !addgame
                      ${escapeHtml(game.library_code)}
                    </div>

                    <button
                      class="find-btn"
                      data-copy-game-command="!addgame ${escapeHtml(
                        game.library_code,
                      )}"
                      style="
                        margin-top: 8px;
                      "
                    >
                      COPY REQUEST COMMAND
                    </button>
                  `
                  : game.completed
                    ? `
                      <div class="command-example">
                        &gt;
                        STATUS:
                        ALREADY COMPLETED
                      </div>
                    `
                    : `
                      <div class="command-example">
                        &gt;
                        SPECIAL REQUEST //
                        NOT AVAILABLE FOR
                        SCHMECKLES
                      </div>
                    `
              }

            </div>
          `;
      })
      .join("");
  }

  renderResults();

  search.addEventListener("input", () => {
    renderResults(search.value);
  });

  document
    .getElementById("publicLibraryClear")
    .addEventListener("click", () => {
      search.value = "";

      renderResults();

      search.focus();
    });

  document
    .getElementById("publicLibraryBackBtn")
    .addEventListener("click", () => {
      renderPlatformSelector(games);
    });

  results.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-game-command]");

    if (!button) {
      return;
    }

    const command = button.dataset.copyGameCommand;

    try {
      await navigator.clipboard.writeText(command);

      const original = button.textContent;

      button.textContent = "COPIED.";

      setTimeout(() => {
        button.textContent = original;
      }, 1200);
    } catch (error) {
      console.error("Clipboard failed.", error);

      window.prompt("COPY THIS COMMAND:", command);
    }
  });
}

export async function loadGameLibrary() {
  const container = document.getElementById("gameLibraryContainer");

  if (!container) {
    return;
  }

  container.innerHTML = "CONNECTING TO OXNET SOFTWARE ARCHIVE...";

  try {
    const response = await fetch(`${API_URL}/game-library`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Game library returned ${response.status}`);
    }

    const data = await response.json();

    renderPlatformSelector(data.games || []);
  } catch (error) {
    console.error("OXNET game library failed.", error);

    container.innerHTML = `
      <div class="empty">
        *** OXNET SOFTWARE ARCHIVE UNAVAILABLE.
      </div>
    `;
  }
}
