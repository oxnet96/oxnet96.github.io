import {
  API_URL,
  SESSION_KEY
} from "./config.js";

import {
  escapeHtml,
  getCommandStats
} from "./commands.js";

export async function loadAccount() {
  const accountUser =
    document.getElementById("accountUser");

  const accountBalance =
    document.getElementById("accountBalance");

  const accountAuth =
    document.getElementById("accountAuth");

  const accountRedemptions =
    document.getElementById("accountRedemptions");

  /*
    If Twitch just redirected us back with a
    new session, save it and clean the URL.
  */

  const hash =
    window.location.hash;

  if (hash.startsWith("#session=")) {
    const session =
      decodeURIComponent(
        hash.substring("#session=".length)
      );

    localStorage.setItem(
      SESSION_KEY,
      session
    );

    history.replaceState(
      null,
      "",
      window.location.pathname +
      window.location.search
    );
  }

  const session =
    localStorage.getItem(
      SESSION_KEY
    );

  /*
    No Twitch login yet.
  */

  if (!session) {
    accountUser.textContent =
      "GUEST";

    accountBalance.textContent =
      "---";

    accountAuth.textContent =
      "NOT CONNECTED";

    accountRedemptions.textContent =
      "LOGIN REQUIRED";

    return;
  }

  /*
    Ask OXNET API who this session belongs to.
  */

  try {
    const response =
      await fetch(
        `${API_URL}/me`,
        {
          cache: "no-store",

          headers: {
            "Authorization":
              `Bearer ${session}`
          }
        }
      );

    if (response.status === 401) {
      localStorage.removeItem(
        SESSION_KEY
      );

      accountUser.textContent =
        "GUEST";

      accountBalance.textContent =
        "---";

      accountAuth.textContent =
        "SESSION EXPIRED";

      accountRedemptions.textContent =
        "LOGIN REQUIRED";

      return;
    }

    if (!response.ok) {
      throw new Error(
        `OXNET API returned ${response.status}`
      );
    }

    const data =
      await response.json();

    accountUser.textContent =
      data.user ||
      data.login ||
      "UNKNOWN USER";

    accountBalance.textContent =
      Number(
        data.schmeckles || 0
      ).toLocaleString();

    accountAuth.textContent =
      "TWITCH CONNECTED";

    accountRedemptions.textContent =
      "ONLINE";

    const {
      publicChatCommands,
      paidSfx
    } = getCommandStats();

    document
      .getElementById("statusBox")
      .innerHTML = `
        CONNECTED TO OXNET_96<br>
        USER: ${escapeHtml(data.login)}<br>
        ECONOMY: SCHMECKLES<br>
        PUBLIC CHAT CMDS: ${publicChatCommands}<br>
        PAID SFX: ${paidSfx}<br>
        WATCH RATE: +1 / LIVE MIN<br>
        SFX RATE: 100 EACH<br>
        CLOCK IN: +100 / STREAM<br>
        FIRST CLAIM: +500<br>
        <br>
        BACKEND: ONLINE
      `;
  }
  catch (error) {
    console.error(
      "OXNET account lookup failed.",
      error
    );

    accountUser.textContent =
      "OFFLINE";

    accountBalance.textContent =
      "---";

    accountAuth.textContent =
      "CONNECTION ERROR";

    accountRedemptions.textContent =
      "UNAVAILABLE";
  }
}
