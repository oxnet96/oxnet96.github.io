let allCommands = [];
let currentFilter = "all";

export function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function categoryLabel(category) {
  const labels = {
    social: "UTILITY",
    schmeckles: "SCHMECKLES",
    sfx: "SFX",
    redemption: "REDEMPTION"
  };

  return labels[normalize(category)] ||
    String(category || "").toUpperCase();
}

function kindLabel(kind) {
  const labels = {
    chat: "CHAT",
    "channel-point": "CHANNEL POINT",
    portal: "OXNET PORTAL",
    planned: "SYSTEM"
  };

  return labels[normalize(kind)] || "";
}

export function getCommandStats() {
  return {
    publicChatCommands:
      allCommands.filter(item =>
        normalize(item.status) === "available" &&
        normalize(item.kind) === "chat"
      ).length,

    paidSfx:
      allCommands.filter(item =>
        normalize(item.category) === "sfx" &&
        normalize(item.status) === "available"
      ).length
  };
}

export function renderCommands() {
  const container =
    document.getElementById("commandsContainer");

  const query =
    normalize(
      document.getElementById("searchInput").value
    );

  const filtered =
    allCommands.filter(cmd => {
      let matchesFilter = false;

      if (currentFilter === "all") {
        matchesFilter = true;
      }
      else if (currentFilter === "planned") {
        matchesFilter =
          normalize(cmd.status) === "planned";
      }
      else {
        matchesFilter =
          normalize(cmd.category) === currentFilter;
      }

      const haystack = [
        cmd.command,
        cmd.category,
        cmd.kind,
        cmd.description,
        cmd.example,
        cmd.status,
        cmd.cooldown
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        haystack.includes(query);

      return (
        matchesFilter &&
        matchesSearch
      );
    });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty">
        *** NO MATCHES FOUND. TRY AGAIN, GENIUS.
      </div>
    `;
    return;
  }

  container.innerHTML =
    filtered.map(cmd => {
      const planned =
        normalize(cmd.status) === "planned";

      const kind =
        kindLabel(cmd.kind);

      return `
        <div class="command-card ${planned ? "planned" : ""}">

          <div class="command-title">

            <div class="command-name">
              ${escapeHtml(cmd.command)}
            </div>

            <span class="badge ${planned ? "planned" : "status"}">
              ${planned ? "COMING SOON" : categoryLabel(cmd.category)}
            </span>

            ${
              kind
                ? `
                  <span class="badge kind">
                    ${escapeHtml(kind)}
                  </span>
                `
                : ""
            }

            ${
              Number(cmd.cost || 0) > 0
                ? `
                  <span class="badge cost">
                    ${escapeHtml(cmd.cost)} SCHMECKLES
                  </span>
                `
                : ""
            }

            ${
              cmd.cooldown &&
              normalize(cmd.cooldown) !== "coming soon"
                ? `
                  <span class="badge cooldown">
                    ${escapeHtml(cmd.cooldown)}
                  </span>
                `
                : ""
            }

            ${
              cmd.isNew
                ? `
                  <span class="badge new">
                    NEW
                  </span>
                `
                : ""
            }

          </div>

          <div class="command-desc">
            ${escapeHtml(cmd.description || "")}
          </div>

          ${
            cmd.example
              ? `
                <div class="command-example">
                  &gt; ${escapeHtml(cmd.example)}
                </div>
              `
              : ""
          }

        </div>
      `;
    })
      .join("");
}

export function bindCommandUI() {
  const buttons =
    document.querySelectorAll(".nav-btn");

  buttons.forEach(btn => {
    btn.addEventListener(
      "click",
      () => {
        buttons.forEach(
          button =>
            button.classList.remove("active")
        );

        btn.classList.add("active");

        currentFilter =
          btn.dataset.filter;

        renderCommands();
      }
    );
  });

  document
    .getElementById("searchInput")
    .addEventListener(
      "input",
      renderCommands
    );

  document
    .getElementById("findBtn")
    .addEventListener(
      "click",
      renderCommands
    );
}

export function updateStatus() {
  const {
    publicChatCommands,
    paidSfx
  } = getCommandStats();

  document.getElementById("statusBox").innerHTML = `
    CONNECTED TO OXNET_96<br>
    MODE: STATIC PREVIEW<br>
    ECONOMY: SCHMECKLES<br>
    PUBLIC CHAT CMDS: ${publicChatCommands}<br>
    PAID SFX: ${paidSfx}<br>
    WATCH RATE: +1 / LIVE MIN<br>
    SFX RATE: 100 EACH<br>
    CLOCK IN: +100 / STREAM<br>
    FIRST CLAIM: +500<br>
    <br>
    BACKEND: NOT INSTALLED
  `;
}

export async function loadCommands() {
  try {
    const response =
      await fetch(
        "./commands.json",
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "commands.json failed to load"
      );
    }

    allCommands =
      await response.json();

    updateStatus();
    renderCommands();
  }
  catch (error) {
    console.error(
      "OXNET command database failed.",
      error
    );

    allCommands = [];

    document
      .getElementById("statusBox")
      .innerHTML = `
        CONNECTED TO OXNET_96<br>
        COMMAND DATABASE: UNAVAILABLE<br>
        <br>
        BACKEND: DEGRADED
      `;

    document
      .getElementById("commandsContainer")
      .innerHTML = `
        <div class="empty">
          *** COMMAND DATABASE FAILED TO LOAD.
        </div>
      `;
  }
}
