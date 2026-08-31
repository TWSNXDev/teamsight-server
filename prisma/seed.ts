import "dotenv/config";
import { prisma } from "../src/db.js";
import { auth } from "../src/auth.js";

const DEMO_PASSWORD = "password123";

const TEAMS = ["North Region", "South Region", "East Region", "West Region"];

const PRODUCTS = [
  "Wireless Mouse",
  "Mechanical Keyboard",
  "Standing Desk",
  "Ergonomic Office Chair",
  "27\" Monitor",
  "Monitor Arm",
  "Laptop Stand",
  "USB-C Dock",
  "Noise-Cancelling Headphones",
  "HD Webcam",
  "Desk Lamp",
  "Whiteboard",
  "Conference Speakerphone",
  "Label Printer",
  "Ergonomic Footrest",
];

interface SeedUser {
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "VIEWER";
  team: string | null;
}

const USERS: SeedUser[] = [
  { email: "admin@teamsight.dev", name: "Ava Administrator", role: "ADMIN", team: null },
  { email: "manager.north@teamsight.dev", name: "Noah Carter", role: "MANAGER", team: "North Region" },
  { email: "manager.south@teamsight.dev", name: "Sofia Ramirez", role: "MANAGER", team: "South Region" },
  { email: "manager.east@teamsight.dev", name: "Ethan Wu", role: "MANAGER", team: "East Region" },
  { email: "manager.west@teamsight.dev", name: "Willow Bennett", role: "MANAGER", team: "West Region" },
  { email: "viewer.north@teamsight.dev", name: "Nora Patel", role: "VIEWER", team: "North Region" },
  { email: "viewer.south@teamsight.dev", name: "Sam Osei", role: "VIEWER", team: "South Region" },
  { email: "viewer.east@teamsight.dev", name: "Ella Kim", role: "VIEWER", team: "East Region" },
  { email: "viewer.west@teamsight.dev", name: "Wyatt Cole", role: "VIEWER", team: "West Region" },
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

async function getOrCreateUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  await auth.api.signUpEmail({
    body: { email, password: DEMO_PASSWORD, name },
  });

  return prisma.user.findUniqueOrThrow({ where: { email } });
}

async function main() {
  const teamByName = new Map<string, { id: string; name: string }>();
  for (const name of TEAMS) {
    const team = await prisma.team.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    teamByName.set(name, team);
  }
  console.log(`Seeded ${teamByName.size} teams`);

  const userByEmail = new Map<string, { id: string; teamId: string | null }>();
  for (const seedUser of USERS) {
    const user = await getOrCreateUser(seedUser.email, seedUser.name);
    const teamId = seedUser.team ? teamByName.get(seedUser.team)!.id : null;

    await prisma.user.update({
      where: { id: user.id },
      data: { role: seedUser.role, teamId },
    });

    userByEmail.set(seedUser.email, { id: user.id, teamId });
  }
  console.log(`Seeded ${userByEmail.size} users (password for all: "${DEMO_PASSWORD}")`);

  const { count: deletedCount } = await prisma.salesRecord.deleteMany();
  console.log(`Cleared ${deletedCount} existing sales records`);

  const recorders = USERS.filter((u) => u.team !== null);
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  const records = Array.from({ length: 220 }).map(() => {
    const recorder = randomItem(recorders);
    const team = teamByName.get(recorder.team!)!;
    const user = userByEmail.get(recorder.email)!;
    const soldAt = new Date(now - randomInt(0, ninetyDaysMs));

    return {
      product: randomItem(PRODUCTS),
      amount: randomInt(500, 18000),
      soldAt,
      teamId: team.id,
      recordedById: user.id,
    };
  });

  await prisma.salesRecord.createMany({ data: records });
  console.log(`Seeded ${records.length} sales records across the last 90 days`);
}

main().finally(() => prisma.$disconnect());
