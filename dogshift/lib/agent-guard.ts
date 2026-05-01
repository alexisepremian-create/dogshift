import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Checks whether an agent is marked active in AgentConfig.
 * Returns a 503 NextResponse if the agent is disabled, or null to allow the request through.
 * Fails open: if the DB is unavailable the agent continues to run.
 */
export async function checkAgentActive(slug: string): Promise<NextResponse | null> {
  try {
    const config = await prisma.agentConfig.findUnique({
      where: { slug },
      select: { active: true },
    });
    if (config && !config.active) {
      return NextResponse.json(
        { error: "Agent désactivé", slug, code: "AGENT_INACTIVE" },
        { status: 503 }
      );
    }
  } catch {
    // Fail-open: if the DB is unavailable, allow the agent to continue
  }
  return null;
}
