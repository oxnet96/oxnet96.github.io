import {
  API_URL
} from "./config.js";

import {
  mergeCommands
} from "./commands.js";

const CHAT_COMMANDS = {
  crt_glitch: "!crt",
  bsod: "!bsod",
  commercial_break: "!commercial",
  rewind: "!rewind",
  remote_control: "!remote"
};

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

function commandFor(item) {
  if (CHAT_COMMANDS[item.key]) {
    return CHAT_COMMANDS[item.key];
  }

  return `!${String(item.key || "redeem")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")}`;
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
      (data.redemptions || []).map(item => {
        const chatCommand =
          commandFor(item);

        return {
          name: item.name,
          command: chatCommand,
          category: "redemption",
          kind: "chat-redemption",
          description: item.description || "",
          cost: Number(item.cost || 0),
          cooldown: formatCooldown(
            item.cooldown_seconds
          ),
          example:
            `REDEEM IN TWITCH CHAT: ${chatCommand}`,
          status: "available",
          isNew: false,
          redemption_key: item.key,
          source: "neon-redemption"
        };
      });

    mergeCommands(items);
  }
  catch (error) {
    console.error(
      "OXNET redemption catalog failed.",
      error
    );
  }
}
