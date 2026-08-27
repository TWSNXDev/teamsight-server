import "dotenv/config";
import { prisma } from "../src/db.js";

async function main() {
  const team = await prisma.team.upsert({
    where: { name: "ภาคเหนือ" },
    update: {},
    create: { name: "ภาคเหนือ" },
  });

  console.log("Created team:", team);

  const admin = await prisma.user.update({
    where: { email: "test2@example.com" },
    data: { role: "ADMIN", teamId: team.id },
  });

  console.log("Promoted to admin:", admin.email);
}

main().finally(() => prisma.$disconnect());
