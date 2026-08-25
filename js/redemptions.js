import {
  API_URL
} from "./config.js";

import {
  mergeCommands
} from "./commands.js";


function formatCooldown(seconds) {
  const value =
    Number(seconds || 0);

  if (value <= 0) {
    return "NO COOLDOWN";
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


export async function loadRedemptions() {
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

    const items =
      (data.redemptions || []).map(item => ({
        name: item.name,
        command: item.name,
        description: item.description || "",
        category: "redemption",
        kind: "redemption",
        status: "LIVE",
        cost: Number(item.cost),
        cooldown: formatCooldown(
          item.cooldown_seconds
        ),
        redemption_key: item.key,
        source: "neon"
      }));

    mergeCommands(items);

  } catch (error) {
    console.error(
      "OXNET redemption catalog failed.",
      error
    );
  }
}