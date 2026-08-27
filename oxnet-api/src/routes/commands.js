import { jsonResponse } from "../lib/http.js";

export async function handleCommandRoutes(context) {
  const { request, url, sql, headers } = context;

  if (url.pathname !== "/commands" || request.method !== "GET") {
    return null;
  }

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
        sort_order
      from portal_commands
      where status <> 'hidden'
      order by sort_order asc, id asc
    `;

    return jsonResponse(
      {
        commands: rows.map((row) => ({
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
        })),
      },
      200,
      headers,
    );
  } catch (error) {
    console.error("Command catalog failed:", error);

    return jsonResponse(
      {
        error: "Command catalog failed",
      },
      500,
      headers,
    );
  }
}
