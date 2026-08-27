import {
  API_URL,
  SESSION_KEY
} from "./config.js";

import {
  escapeHtml,
  getCommandStats
} from "./commands.js";

function setLoggedOutState(message = "NOT CONNECTED") {
  document.getElementById("accountUser").textContent =
    "GUEST";

  document.getElementById("accountBalance").textContent =
    "---";

  document.getElementById("accountAuth").textContent =
    message;

  document.getElementById("accountRedemptions").textContent =
    "LOGIN REQUIRED";

  const authButton =
    document.getElementById("authButton");

  authButton.textContent =
    "LOGIN WITH TWITCH";

  authButton.onclick = () => {
    window.location.href =
      `${API_URL}/auth/twitch`;
  };

  const authSafetyNotice = document.getElementById("authSafetyNotice");

  if (authSafetyNotice) {
    authSafetyNotice.hidden = false;
  }
}

function setLoggedInState(data) {
  document.getElementById("accountUser").textContent =
    data.user ||
    data.login ||
    "UNKNOWN USER";

  document.getElementById("accountBalance").textContent =
    Number(
      data.schmeckles || 0
    ).toLocaleString();

  document.getElementById("accountAuth").textContent =
    "TWITCH CONNECTED";

  document.getElementById("accountRedemptions").textContent =
    "ONLINE";

  const authButton =
    document.getElementById("authButton");

  authButton.textContent =
    "LOG OUT";

  authButton.onclick = () => {
    localStorage.removeItem(
      SESSION_KEY
    );

    window.location.reload();
  };

  const authSafetyNotice = document.getElementById("authSafetyNotice");

  if (authSafetyNotice) {
    authSafetyNotice.hidden = true;
  }
}

function updateOnlineStatus(data) {
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

export async function loadAccount() {

  /*
    Capture Twitch session after redirect.
  */

  const hash =
    window.location.hash;

  if (hash.startsWith("#session=")) {
    const session =
      decodeURIComponent(
        hash.substring(
          "#session=".length
        )
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


  /*
    Handle Twitch auth failure/denial.
  */

  if (hash === "#auth=denied") {
    history.replaceState(
      null,
      "",
      window.location.pathname
    );

    setLoggedOutState(
      "LOGIN CANCELLED"
    );

    return;
  }

  if (hash === "#auth=error") {
    history.replaceState(
      null,
      "",
      window.location.pathname
    );

    setLoggedOutState(
      "LOGIN ERROR"
    );

    return;
  }


  const session =
    localStorage.getItem(
      SESSION_KEY
    );


  /*
    Viewer is not logged in.
  */

  if (!session) {
    setLoggedOutState();
    return;
  }


  /*
    Ask OXNET API who owns this session.
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

      setLoggedOutState(
        "SESSION EXPIRED"
      );

      return;
    }


    if (!response.ok) {
      throw new Error(
        `OXNET API returned ${response.status}`
      );
    }


    const data =
      await response.json();


    setLoggedInState(data);
    updateOnlineStatus(data);

  }

  catch (error) {
    console.error(
      "OXNET account lookup failed.",
      error
    );

    document
      .getElementById("accountUser")
      .textContent =
      "OFFLINE";

    document
      .getElementById("accountBalance")
      .textContent =
      "---";

    document
      .getElementById("accountAuth")
      .textContent =
      "CONNECTION ERROR";

    document
      .getElementById("accountRedemptions")
      .textContent =
      "UNAVAILABLE";

    const authButton =
      document.getElementById("authButton");

    authButton.textContent =
      "RETRY";

    authButton.onclick = () => {
      window.location.reload();
    };
  }
}