import { prisma } from "../db.js";
import type { ToolDefinition } from "./types.js";

export const sitterTools: ToolDefinition[] = [
  {
    name: "list_sitters",
    description: "Liste les profils sitters avec leur statut de vérification et lifecycle",
    inputSchema: {
      type: "object",
      properties: {
        verificationStatus: {
          type: "string",
          enum: ["not_verified", "pending", "approved", "rejected"],
          description: "Filtrer par statut de vérification (optionnel)",
        },
        lifecycleStatus: {
          type: "string",
          enum: ["application_received", "selected", "contract_to_sign", "contract_signed", "activated"],
          description: "Filtrer par étape du parcours (optionnel)",
        },
        published: { type: "boolean", description: "Filtrer par publication (optionnel)" },
        limit: { type: "number", description: "Nombre max (défaut: 20)", default: 20 },
      },
    },
    handler: async (args: any) => {
      const where: any = {};
      if (args.verificationStatus) where.verificationStatus = args.verificationStatus;
      if (args.lifecycleStatus) where.lifecycleStatus = args.lifecycleStatus;
      if (args.published !== undefined) where.published = args.published;

      const sitters = await prisma.sitterProfile.findMany({
        take: args.limit ?? 20,
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          _count: { select: { contractAmendmentAcceptances: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      return { content: [{ type: "text", text: JSON.stringify(sitters, null, 2) }] };
    },
  },

  {
    name: "get_sitter_details",
    description: "Détails complets d'un sitter par son ID",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "ID du sitterProfile" } },
      required: ["id"],
    },
    handler: async (args: any) => {
      const sitter = await prisma.sitterProfile.findUnique({
        where: { id: args.id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
          verificationAccessLogs: { orderBy: { createdAt: "desc" }, take: 5 },
          contractAmendmentAcceptances: { orderBy: { acceptedAt: "desc" } },
        },
      });

      if (!sitter) {
        return { content: [{ type: "text", text: "❌ Sitter introuvable" }], isError: true };
      }

      const [bookingCount, reviewCount, avgRating] = await Promise.all([
        prisma.booking.count({ where: { sitterId: sitter.sitterId } }),
        prisma.review.count({ where: { sitterId: sitter.sitterId } }),
        prisma.review.aggregate({
          where: { sitterId: sitter.sitterId },
          _avg: { rating: true },
        }),
      ]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...sitter,
                stats: {
                  totalBookings: bookingCount,
                  totalReviews: reviewCount,
                  averageRating: avgRating._avg.rating ?? null,
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
    name: "list_pending_applications",
    description: "Liste les candidatures sitters en attente de traitement",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 20 },
        status: {
          type: "string",
          enum: ["PENDING", "CONTACTED", "ACCEPTED", "ACTIVATED", "REJECTED"],
          description: "Filtrer par statut (défaut: PENDING)",
        },
      },
    },
    handler: async (args: any) => {
      const status = args.status ?? "PENDING";
      const applications = await prisma.pilotSitterApplication.findMany({
        take: args.limit ?? 20,
        where: { status },
        orderBy: { createdAt: "desc" },
      });

      return { content: [{ type: "text", text: JSON.stringify(applications, null, 2) }] };
    },
  },

  {
    name: "update_sitter_verification",
    description: "⚠️ Met à jour le statut de vérification d'un sitter (admin)",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID du sitterProfile" },
        status: {
          type: "string",
          enum: ["approved", "rejected"],
          description: "Nouveau statut",
        },
        notes: { type: "string", description: "Notes internes (optionnel)" },
      },
      required: ["id", "status"],
    },
    handler: async (args: any) => {
      await prisma.sitterProfile.update({
        where: { id: args.id },
        data: {
          verificationStatus: args.status,
          verificationReviewedAt: new Date(),
          verificationNotes: args.notes,
        },
      });
      return { content: [{ type: "text", text: `✅ Vérification sitter ${args.id} → ${args.status}` }] };
    },
  },
];