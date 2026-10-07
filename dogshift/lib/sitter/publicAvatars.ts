import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Transform legacy inline images inside Postgres, BEFORE network transfer.
 * Lists and HTML must never download megabytes of base64 just to discard them.
 * No data migration: the existing cached image endpoint still serves the bytes.
 */
export async function loadPublicAvatarUrls(sitterIds: string[]): Promise<Map<string, string | null>> {
  if (!sitterIds.length) return new Map();
  const rows = await prisma.$queryRaw<Array<{ sitterId: string; avatarUrl: string | null }>>(Prisma.sql`
    SELECT s."sitterId",
      CASE WHEN btrim(COALESCE(s."avatarUrl", u.image, '')) LIKE 'data:%'
        THEN '/api/sitters/' || s."sitterId" || '/avatar?v=' || extract(epoch FROM s."updatedAt")::text
        ELSE NULLIF(btrim(COALESCE(s."avatarUrl", u.image, '')), '')
      END AS "avatarUrl"
    FROM "SitterProfile" s JOIN "User" u ON u.id = s."userId"
    WHERE s."sitterId" IN (${Prisma.join(sitterIds)})
  `);
  return new Map(rows.map(row => [row.sitterId, row.avatarUrl]));
}

/** Keep legacy profile photos/documents out of a public detail read too. */
export async function loadPublicLegacyDetails(sitterId: string): Promise<Record<string, unknown> | null> {
  const rows = await prisma.$queryRaw<Array<{ details: Record<string, unknown> | null }>>(Prisma.sql`
    SELECT CASE WHEN u."hostProfileJson" IS JSON OBJECT THEN
      jsonb_build_object('bio', u."hostProfileJson"::jsonb -> 'bio',
                         'boardingDetails', u."hostProfileJson"::jsonb -> 'boardingDetails')
      ELSE NULL END AS details
    FROM "SitterProfile" s JOIN "User" u ON u.id = s."userId"
    WHERE s."sitterId" = ${sitterId}
  `);
  return rows[0]?.details ?? null;
}
