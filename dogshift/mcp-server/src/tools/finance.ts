import { prisma } from "../db.js";
import type { ToolDefinition } from "./types.js";

export const financeTools: ToolDefinition[] = [
  {
    name: "get_revenue",
    description: "Affiche le chiffre d'affaires sur une période (en francs suisses)",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Date début (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Date fin (YYYY-MM-DD)" },
      },
    },
    handler: async (args: Record<string, any>) => {
      const start = args.startDate ? new Date(args.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = args.endDate ? new Date(args.endDate + "T23:59:59Z") : new Date();

      const bookings = await prisma.booking.findMany({
        where: {
          status: { in: ["PAID", "CONFIRMED"] },
          createdAt: { gte: start, lte: end },
        },
        select: {
          amount: true,
          platformFeeAmount: true,
          sitterPayoutAmount: true,
          stripeProcessingFeeAmount: true,
          serviceType: true,
        },
      });

      const sum = (fn: (b: any) => number) => bookings.reduce((acc: number, b: any) => acc + fn(b), 0);

      const totalRevenue = sum((b: any) => b.amount);
      const totalFees = sum((b: any) => b.platformFeeAmount);
      const totalSitterPayouts = sum((b: any) => b.sitterPayoutAmount ?? 0);
      const totalStripeFees = sum((b: any) => b.stripeProcessingFeeAmount);

      const byService: Record<string, { count: number; revenue: number }> = {};
      for (const b of bookings) {
        const type = b.serviceType ?? "unknown";
        if (!byService[type]) byService[type] = { count: 0, revenue: 0 };
        byService[type].count++;
        byService[type].revenue += b.amount;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                period: { start: start.toISOString(), end: end.toISOString() },
                totalRevenue: totalRevenue / 100,
                platformFees: totalFees / 100,
                sitterPayouts: totalSitterPayouts / 100,
                stripeFees: totalStripeFees / 100,
                netRevenue: (totalRevenue - totalFees - totalStripeFees) / 100,
                bookingCount: bookings.length,
                byServiceType: Object.entries(byService).map(([type, data]) => ({
                  type,
                  count: data.count,
                  revenue: data.revenue / 100,
                })),
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
    name: "get_pending_payouts",
    description: "Liste les paiements sitters en attente de release",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const pending = await prisma.booking.findMany({
        where: { status: "PAID", payoutStatus: "PENDING", payoutReleasedAt: null },
        include: {
          user: { select: { id: true, name: true } },
          sitter: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      const total = pending.reduce((s: number, b: any) => s + (b.sitterPayoutAmount ?? 0), 0);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ count: pending.length, totalPending: total / 100, bookings: pending }, null, 2),
          },
        ],
      };
    },
  },

  {
    name: "get_recent_finance_events",
    description: "Liste les événements financiers récents",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", default: 20 } },
    },
    handler: async (args: Record<string, any>) => {
      const events = await prisma.bookingFinanceEvent.findMany({
        take: args.limit ?? 20,
        orderBy: { createdAt: "desc" },
        include: {
          booking: { select: { id: true, amount: true, status: true } },
        },
      });

      return { content: [{ type: "text", text: JSON.stringify(events, null, 2) }] };
    },
  },
];