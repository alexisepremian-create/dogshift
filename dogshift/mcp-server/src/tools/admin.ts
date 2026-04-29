import { prisma } from "../db.js";
import type { ToolDefinition } from "./types.js";

export const adminTools: ToolDefinition[] = [
  {
    name: "get_dashboard",
    description: "Statistiques clés pour le tableau de bord admin",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Période en jours (défaut: 30)", default: 30 },
      },
    },
    handler: async (args: any) => {
      const days = args.days ?? 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [totalUsers, totalSitters, totalBookings, recentBookings, pendingApps, pendingVerifications, revenue, activeConversations] =
        await Promise.all([
          prisma.user.count(),
          prisma.sitterProfile.count(),
          prisma.booking.count({ where: { status: { not: "DRAFT" } } }),
          prisma.booking.count({ where: { createdAt: { gte: since } } }),
          prisma.pilotSitterApplication.count({ where: { status: "PENDING" } }),
          prisma.sitterProfile.count({ where: { verificationStatus: "pending" } }),
          prisma.booking.aggregate({
            where: { status: "PAID", createdAt: { gte: since } },
            _sum: { amount: true, platformFeeAmount: true },
          }),
          prisma.conversation.count({ where: { lastMessageAt: { gte: since } } }),
        ]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                period: `${days} jours`,
                users: { total: totalUsers },
                sitters: { total: totalSitters, pendingVerifications },
                bookings: { total: totalBookings, recent: recentBookings },
                revenue: {
                  total: (revenue._sum.amount ?? 0) / 100,
                  fees: (revenue._sum.platformFeeAmount ?? 0) / 100,
                },
                pendingActions: { applications: pendingApps, verifications: pendingVerifications },
                activity: { activeConversations },
                date: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },

  {
    name: "get_platform_status",
    description: "Statut de la plateforme (maintenance, etc.)",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const settings = await prisma.platformSettings.findUnique({ where: { id: "global" } });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                maintenanceMode: settings?.maintenanceMode ?? false,
                maintenanceMessage: settings?.maintenanceMessage ?? null,
                status: settings?.maintenanceMode ? "maintenance" : "online",
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },

  {
    name: "search_audit_log",
    description: "Recherche dans le journal d'audit",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Filtrer par action (ex: booking.created)" },
        targetId: { type: "string", description: "Filtrer par ID cible" },
        limit: { type: "number", default: 20 },
      },
    },
    handler: async (args: any) => {
      const where: any = {};
      if (args.action) where.action = { contains: args.action };
      if (args.targetId) where.targetId = args.targetId;

      const logs = await prisma.auditLog.findMany({
        take: args.limit ?? 20,
        where,
        orderBy: { createdAt: "desc" },
      });

      return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
    },
  },
];