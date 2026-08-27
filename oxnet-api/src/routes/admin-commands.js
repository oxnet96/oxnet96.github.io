import { requireAdmin } from "../lib/admin.js";
import { jsonResponse } from "../lib/http.js";

const ALLOWED_CATEGORIES = [
  "social",
  "schmeckles",
  "sfx",
  "redemption",
];

const ALLOWED_KINDS = [
  "chat",
  "chat-redemption",
  "channel-point",
  "portal",
  "planned",
];

const ALLOWED_STATUSES = [
  "available",
  "planned",
  "hidden",
];

function cleanText(value, maxLength = 1000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeCommandBody(body, existing = null) {
  const command =
    body.command !== undefined
      ? cleanText(body.command, 120)
      : existing?.command ?? "";

  const category =
    body.category !== undefined
      ? cleanText(body.category, 40).toLowerCase()
      : existing?.category ?? "social";

  const kind =
    body.kind !== undefined
      ? cleanText(body.kind, 40).toLowerCase()
      : existing?.kind ?? "chat";

  const description =
    body.description !== undefined
      ? cleanText(body.description, 1000)
      : existing?.description ?? "";

  const cost =
    body.cost !== undefined
      ? Number(body.cost)
      : Number(existing?.cost ?? 0);

  const cooldown =
    body.cooldown !== undefined
      ? cleanText(body.cooldown, 120)
      : existing?.cooldown ?? "";

  const example =
    body.example !== undefined
      ? cleanText(body.example, 250)
      : existing?.example ?? "";

  const status =
    body.status !== undefined
      ? cleanText(body.status, 40).toLowerCase()
      : existing?.status ?? "available";

  const isNew =
    body.isNew !== undefined
      ? Boolean(body.isNew)
      : Boolean(existing?.is_new ?? false);

  const sortOrder =
    body.sort_order !== undefined
      ? Number(body.sort_order)
      : Number(existing?.sort_order ?? 0);

  return {
    command,
    category,
    kind,
    description,
    cost,
    cooldown,
    example,
    status,
    isNew,
    sortOrder,
  };
}

function validateCommand(command) {
  if (!command.command) {
    return "Command is required";
  }

  if (!ALLOWED_CATEGORIES.includes(command.category)) {
    return "Invalid category";
  }

  if (!ALLOWED_KINDS.includes(command.kind)) {
    return "Invalid command kind";
  }

  if (!ALLOWED_STATUSES.includes(command.status)) {
    return "Invalid status";
  }

  if (!Number.isInteger(command.cost) || command.cost < 0) {
    return "Invalid Schmeckle cost";
  }

  if (!Number.isInteger(command.sortOrder)) {
    return "Invalid sort order";
  }

  return null;
}

function mapCommand(row) {
  return {
    id: Number(row.id),
    command: row.command,
    category: row.category,
    kind: row.kind,
    description: row.description,
    cost: Number(row.cost),
    cooldown: row.cooldown,
    example: row.example,
    status: row.status,
    isNew: Boolean(row.is_new),
    sort_order: Number(row.sort_order),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function handleAdminCommandRoutes(context) {
  const { request, url, sql, headers } = context;

  if (!url.pathname.startsWith("/admin/commands")) {
    return null;
  }

  const admin = await requireAdmin(context);

  if (admin.response) {
    return admin.response;
  }

  if (url.pathname === "/admin/commands" && request.method === "GET") {
    try {
      const rows = await sql`
        select
          id,
          command,
          category,
          kind,
          description,
          cost,
          cooldown,
          example,
          status,
          is_new,
          sort_order,
          created_at,
          updated_at
        from portal_commands
        order by sort_order asc, id asc
      `;

      return jsonResponse(
        {
          success: true,
          commands: rows.map(mapCommand),
        },
        200,
        headers,
      );
    } catch (error) {
      console.error("Admin command list failed:", error);

      return jsonResponse(
        {
          error: "Unable to load commands",
        },
        500,
        headers,
      );
    }
  }

  if (
    url.pathname === "/admin/commands/add" &&
    request.method === "POST"
  ) {
    try {
      const body = await request.json();
      const item = normalizeCommandBody(body);
      const validationError = validateCommand(item);

      if (validationError) {
        return jsonResponse(
          {
            error: validationError,
          },
          400,
          headers,
        );
      }

      let sortOrder = item.sortOrder;

      if (sortOrder === 0) {
        const maxRows = await sql`
          select coalesce(max(sort_order), 0) as max_sort
          from portal_commands
        `;

        sortOrder = Number(maxRows[0]?.max_sort ?? 0) + 10;
      }

      const rows = await sql`
        insert into portal_commands (
          command,
          category,
          kind,
          description,
          cost,
          cooldown,
          example,
          status,
          is_new,
          sort_order,
          updated_at
        )
        values (
          ${item.command},
          ${item.category},
          ${item.kind},
          ${item.description},
          ${item.cost},
          ${item.cooldown},
          ${item.example},
          ${item.status},
          ${item.isNew},
          ${sortOrder},
          now()
        )
        returning *
      `;

      return jsonResponse(
        {
          success: true,
          command: mapCommand(rows[0]),
        },
        201,
        headers,
      );
    } catch (error) {
      console.error("Admin command add failed:", error);

      if (error?.code === "23505") {
        return jsonResponse(
          {
            error: "Command already exists",
          },
          409,
          headers,
        );
      }

      return jsonResponse(
        {
          error: "Unable to add command",
        },
        500,
        headers,
      );
    }
  }

  if (
    url.pathname === "/admin/commands/update" &&
    request.method === "POST"
  ) {
    try {
      const body = await request.json();
      const id = Number(body.id);

      if (!Number.isInteger(id) || id < 1) {
        return jsonResponse(
          {
            error: "Valid command ID is required",
          },
          400,
          headers,
        );
      }

      const existingRows = await sql`
        select *
        from portal_commands
        where id = ${id}
        limit 1
      `;

      if (!existingRows.length) {
        return jsonResponse(
          {
            error: "Command not found",
          },
          404,
          headers,
        );
      }

      const item = normalizeCommandBody(body, existingRows[0]);
      const validationError = validateCommand(item);

      if (validationError) {
        return jsonResponse(
          {
            error: validationError,
          },
          400,
          headers,
        );
      }

      const rows = await sql`
        update portal_commands
        set
          command = ${item.command},
          category = ${item.category},
          kind = ${item.kind},
          description = ${item.description},
          cost = ${item.cost},
          cooldown = ${item.cooldown},
          example = ${item.example},
          status = ${item.status},
          is_new = ${item.isNew},
          sort_order = ${item.sortOrder},
          updated_at = now()
        where id = ${id}
        returning *
      `;

      return jsonResponse(
        {
          success: true,
          command: mapCommand(rows[0]),
        },
        200,
        headers,
      );
    } catch (error) {
      console.error("Admin command update failed:", error);

      if (error?.code === "23505") {
        return jsonResponse(
          {
            error: "Command already exists",
          },
          409,
          headers,
        );
      }

      return jsonResponse(
        {
          error: "Unable to update command",
        },
        500,
        headers,
      );
    }
  }

  if (
    url.pathname === "/admin/commands/delete" &&
    request.method === "POST"
  ) {
    try {
      const body = await request.json();
      const id = Number(body.id);

      if (!Number.isInteger(id) || id < 1) {
        return jsonResponse(
          {
            error: "Valid command ID is required",
          },
          400,
          headers,
        );
      }

      const rows = await sql`
        delete from portal_commands
        where id = ${id}
        returning id, command
      `;

      if (!rows.length) {
        return jsonResponse(
          {
            error: "Command not found",
          },
          404,
          headers,
        );
      }

      return jsonResponse(
        {
          success: true,
          deleted: {
            id: Number(rows[0].id),
            command: rows[0].command,
          },
        },
        200,
        headers,
      );
    } catch (error) {
      console.error("Admin command delete failed:", error);

      return jsonResponse(
        {
          error: "Unable to delete command",
        },
        500,
        headers,
      );
    }
  }

  return null;
}
