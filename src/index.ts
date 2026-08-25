import "dotenv/config";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { prisma } from "./db.js";
import { salesRecordsRouter } from "./routes/sales-records.js";
import { teamsRouter } from "./routes/teams.js";
import { errorHandler } from "./middleware/error-handler.js";
import { initSocket } from "./socket.js";

const app = express();
const httpServer = createServer(app);
initSocket(httpServer);

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
});

app.use("/api/sales-records", salesRecordsRouter);
app.use("/api/teams", teamsRouter);

app.use(errorHandler);

const port = process.env.PORT ?? 4000;
httpServer.listen(port, () => {
  console.log(`teamsight-server listening on port ${port}`);
});
