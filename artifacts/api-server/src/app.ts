import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production (Azure, Render, Railway, etc.) serve the built React frontend
// from the same server so a single port handles everything.
if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(process.cwd(), "frontend");
  if (existsSync(staticDir)) {
    app.use(express.static(staticDir));
    // SPA fallback — serve index.html for any unmatched route
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
    logger.info({ staticDir }, "Serving frontend static files");
  }
}

export default app;
