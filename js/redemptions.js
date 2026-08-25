import {
  API_URL
} from "./config.js";

import {
  escapeHtml
} from "./commands.js";


function formatCooldown(seconds) {
  const value =
    Number(seconds || 0);

  if (value <= 0) {
    return "";
  }

  if (value < 60) {
    return `${value} SEC COOLDOWN`;
  }

  if (value % 3600 === 0) {
    const hours =
      value / 3600;

    return `${hours} HR${hours === 1 ? "" : "S"} COOLDOWN`;
  }

  const minutes =
    Math.floor(value / 60);

  return `${minutes} MIN COOLDOWN`;
}


function renderRedemptions(redemptions) {
  const container =
    document.getElementById(
      "redemptionContainer"
    );

  if (!redemptions.length) {
    container.innerHTML = `
      <div class="empty">
        *** NO REDEMPTIONS AVAILABLE.
      </div>
    `;

    return;
  }


  container.innerHTML =
    redemptions.map(item => {

      const cooldown =
        formatCooldown(
          item.cooldown_seconds
        );

      return `
        <div class="command-card">

          <div class="command-title">

            <div class="command-name">
              ${escapeHtml(item.name)}
            </div>

            <span class="badge status">
              REDEMPTION
            </span>

            <span class="badge cost">
              ${Number(item.cost).toLocaleString()}
              SCHMECKLES
            </span>

            ${
              cooldown
                ? `
                  <span class="badge cooldown">
                    ${escapeHtml(cooldown)}
                  </span>
                `
                : ""
            }

          </div>

          <div class="command-desc">
            ${escapeHtml(
              item.description || ""
            )}
          </div>

          <button
            class="find-btn redemption-btn"
            data-redemption-key="${escapeHtml(item.key)}"
            disabled
          >
            REDEEM
          </button>

        </div>
      `;
    })
      .join("");
}


export async function loadRedemptions() {
  const container =
    document.getElementById(
      "redemptionContainer"
    );

  try {
    const response =
      await fetch(
        `${API_URL}/redemptions`,
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {
      throw new Error(
        `Redemption API returned ${response.status}`
      );
    }


    const data =
      await response.json();


    renderRedemptions(
      data.redemptions || []
    );

  }

  catch (error) {
    console.error(
      "OXNET redemption catalog failed.",
      error
    );

    container.innerHTML = `
      <div class="empty">
        *** REDEMPTION DATABASE UNAVAILABLE.
      </div>
    `;
  }
}