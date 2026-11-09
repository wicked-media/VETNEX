import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { env } from "./env";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const server = app.getHttpAdapter().getInstance();
  server.set("trust proxy", 1);
  server.disable("x-powered-by");

  server.use((request: Request, response: Response, next: NextFunction) => {
    const incoming = request.headers["x-request-id"];
    const requestId =
      typeof incoming === "string" && incoming.length > 0 && incoming.length <= 100
        ? incoming
        : randomUUID();
    request.headers["x-request-id"] = requestId;
    response.setHeader("x-request-id", requestId);
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("x-frame-options", "DENY");
    response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  app.enableCors({
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : false,
    credentials: true,
  });
  app.enableShutdownHooks();

  await app.listen(env.port, "0.0.0.0");
  logger.log(`VETNEX API listening on http://0.0.0.0:${env.port} (${env.nodeEnv})`);
}

bootstrap().catch((error) => {
  console.error("Failed to start the VETNEX API", error);
  process.exit(1);
});
