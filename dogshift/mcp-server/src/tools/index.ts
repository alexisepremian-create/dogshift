import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { bookingTools } from "./bookings.js";
import { financeTools } from "./finance.js";
import { sitterTools } from "./sitters.js";
import { adminTools } from "./admin.js";

export function registerAllTools(server: Server) {
  const allTools = [...bookingTools, ...financeTools, ...sitterTools, ...adminTools];

  for (const tool of allTools) {
    server.tool?.(tool.name, tool.description, tool.inputSchema, tool.handler);
  }
}