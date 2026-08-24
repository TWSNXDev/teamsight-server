import "dotenv/config";
import { prisma } from "../src/db.js";

async function main() {
  const team = await prisma.team.upsert({
    where: { name: "ภาคเหนือ" },
    update: {},
    create: { name: "ภาคเหนือ" },
  });

  console.log("Created team:", team);
}

main().finally(() => prisma.$disconnect());
