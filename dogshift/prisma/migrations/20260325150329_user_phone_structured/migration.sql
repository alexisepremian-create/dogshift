-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" VARCHAR(20);

-- Backfill phone from legacy hostProfileJson.phone when available.
DO $$
DECLARE
  r RECORD;
  v_phone TEXT;
BEGIN
  FOR r IN
    SELECT id, "hostProfileJson"
    FROM "User"
    WHERE "phone" IS NULL
      AND "hostProfileJson" IS NOT NULL
      AND length(trim("hostProfileJson")) > 0
  LOOP
    v_phone := NULL;
    BEGIN
      v_phone := trim((r."hostProfileJson"::jsonb ->> 'phone'));
    EXCEPTION WHEN others THEN
      v_phone := NULL;
    END;

    IF v_phone IS NOT NULL AND length(v_phone) > 0 THEN
      UPDATE "User" SET "phone" = v_phone WHERE id = r.id AND "phone" IS NULL;
    END IF;
  END LOOP;
END $$;
