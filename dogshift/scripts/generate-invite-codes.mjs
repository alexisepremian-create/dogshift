import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randomChunk(len) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid confusing chars
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function makeCode() {
  return `DS-${randomChunk(4)}-${randomChunk(4)}`;
}

async function main() {
  const codes = new Set();
  while (codes.size < 30) {
    codes.add(makeCode());
  }

  const singleUseCodes = Array.from(codes);
  const masterCode = `DS-MASTER-${randomChunk(4)}`;

  for (const code of singleUseCodes) {
    await prisma.inviteCode.upsert({
      where: { code },
      create: { code, type: "single_use" },
      update: {},
    });
  }

  await prisma.inviteCode.upsert({
    where: { code: masterCode },
    create: { code: masterCode, type: "master", note: "Alexis" },
    update: { type: "master", note: "Alexis" },
  });

  console.log("\nInvite codes generated/ensured (store securely):\n");
  console.log("MASTER:");
  console.log(masterCode);
  console.log("\nSINGLE_USE (30):");
  for (const code of singleUseCodes) console.log(code);
  console.log("");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
