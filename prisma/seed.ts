import "dotenv/config";
import { prisma } from "../src/db.js";

async function main() {
  const existing = await prisma.team.findUnique({ where: { name: "ภาคเหนือ" } });

  const team = existing
    ? await prisma.team.update({ where: { id: existing.id }, data: { name: "North Region" } })
    : await prisma.team.upsert({
        where: { name: "North Region" },
        update: {},
        create: { name: "North Region" },
      });

  console.log("Created team:", team);

  const admin = await prisma.user.update({
    where: { email: "test2@example.com" },
    data: { role: "ADMIN", teamId: team.id },
  });

  console.log("Promoted to admin:", admin.email);
}

main().finally(() => prisma.$disconnect());
