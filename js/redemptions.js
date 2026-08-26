import {
  API_URL
} from "./config.js";

import {
  mergeCommands
} from "./commands.js";

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
        category: "redemption",
        kind: "planned",
        description: item.description || "",
        cost: 0,
        cooldown: "COMING SOON",
        example: "OXNET EXPANSION // COMING SOON",
        status: "planned",
        isNew: false,
        redemption_key: item.key,
        source: "neon-redemption"
      }));

    mergeCommands(items);
  }
  catch (error) {
    console.error(
      "OXNET redemption catalog failed.",
      error
    );
  }
}
