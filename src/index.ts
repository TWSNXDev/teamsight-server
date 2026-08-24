import "dotenv/config";
import express from "express";
import { prisma } from "./db.js";

const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
});

const port = process.env.PORT ?? 4000;
app.listen(port, () => {
  console.log(`teamsight-server listening on port ${port}`);
});
