import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApp } from "./helpers";

describe("GET /health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports database connectivity", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);
    expect(response.body).toMatchObject({
      status: "ok",
      database: "ok",
      service: "vetnex-api",
    });
  });

  it("does not require authentication", async () => {
    await request(app.getHttpServer()).get("/health").expect(200);
  });
});
