import { prisma } from "../db.js";
import type { ToolDefinition } from "./types.js";

export const bookingTools: ToolDefinition[] = [
  {
    name: "list_recent_bookings",
    description: "Liste les réservations récentes avec leur statut. Par défaut : 7 derniers jours.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Nombre de jours en arrière (défaut: 7)", default: 7 },
        limit: { type: "number", description: "Nombre max de résultats (défaut: 20)", default: 20 },
        status: {
          enum: ["DRAFT", "PENDING_PAYMENT", "PENDING_ACCEPTANCE", "PAID", "CONFIRMED", "CANCELLED", "REFUNDED"],
          description: "Filtrer par statut (optionnel)",
        },
      },
    },
    handler: async (args: Record<string, any>) => {
      const days = args.days ?? 7;
      const limit = args.limit ?? 20;
      const where: Record<string, any> = {
        createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      };
      if (args.status) where.status = args.status;

      const bookings = await prisma.booking.findMany({
        take: limit,
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          sitter: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return { content: [{ type: "text", text: JSON.stringify(bookings, null, 2) }] };
    },
  },

  {
    name: "get_booking_details",
    description: "Affiche les détails complets d'une réservation par son ID",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "ID de la réservation" } },
      required: ["id"],
    },
    handler: async (args: Record<string, any>) => {
      const booking = await prisma.booking.findUnique({
        where: { id: args.id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, role: true } },
          sitter: { select: { id: true, name: true, email: true } },
          review: true,
          financeEvents: { orderBy: { createdAt: "desc" } },
        },
      });

      if (!booking) {
        return { content: [{ type: "text", text: "❌ Réservation introuvable" }], isError: true };
      }

      return { content: [{ type: "text", text: JSON.stringify(booking, null, 2) }] };
    },
  },

  {
    name: "get_booking_stats",
    description: "Statistiques globales des réservations sur une période",
    inputSchema: {
      type: "object",
      properties: { days: { type: "number", description: "Période en jours (défaut: 30)", default: 30 } },
    },
    handler: async (args: Record<string, any>) => {
      const days = args.days ?? 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [total, byStatus, revenue] = await Promise.all([
        prisma.booking.count({ where: { createdAt: { gte: since } } }),
        prisma.booking.groupBy({
          by: ["status"],
          where: { createdAt: { gte: since } },
          _count: { id: true },
        }),
        prisma.booking.aggregate({
          where: { status: "PAID", createdAt: { gte: since } },
          _sum: { amount: true, platformFeeAmount: true },
        }),
      ]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                period: `${days} jours`,
                totalBookings: total,
                byStatus: byStatus.map((s: any) => ({ status: s.status, count: s._count.id })),
                revenue: {
                  total: revenue._sum.amount ?? 0,
                  fees: revenue._sum.platformFeeAmount ?? 0,
                  net: (revenue._sum.amount ?? 0) - (revenue._sum.platformFeeAmount ?? 0),
                },
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
    name: "update_booking_status",
    description: "⚠️ Met à jour le statut d'une réservation (usage admin uniquement)",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID de la réservation" },
        status: {
          type: "string",
          enum: ["DRAFT", "PENDING_PAYMENT", "PENDING_ACCEPTANCE", "PAID", "CONFIRMED", "CANCELLED", "REFUNDED"],
          description: "Nouveau statut",
        },
      },
      required: ["id", "status"],
    },
    handler: async (args: Record<string, any>) => {
      const booking = await prisma.booking.update({
        where: { id: args.id },
        data: {
          status: args.status,
          ...(args.status === "CANCELLED" ? { canceledAt: new Date() } : {}),
        },
      });
      return { content: [{ type: "text", text: `✅ Réservation ${args.id} mise à jour → ${args.status}` }] };
    },
  },
];