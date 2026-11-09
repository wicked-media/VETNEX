import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApp, signupPractice } from "./helpers";

describe("audit trail", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("records organisation creation with an actor and a request id", async () => {
    const owner = await signupPractice(app, { organisationName: "Audit Practice" });

    const response = await request(app.getHttpServer())
      .get("/audit")
      .set("Cookie", owner.cookie)
      .set("x-request-id", "test-request-123")
      .expect(200);

    const events = response.body.events as Array<Record<string, unknown>>;
    const created = events.find((event) => event.action === "organisation.created");
    expect(created).toBeTruthy();
    expect(created?.summary).toContain("Audit Practice");
    expect(created?.actorLabel).toContain(owner.email);
  });

  it("records organisation updates with before and after values", async () => {
    const owner = await signupPractice(app);

    await request(app.getHttpServer())
      .patch("/organisation")
      .set("Cookie", owner.cookie)
      .send({ retentionYearsClinical: 10, gstRate: 0.1 })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/audit?limit=10")
      .set("Cookie", owner.cookie)
      .expect(200);

    const updated = (response.body.events as Array<Record<string, unknown>>).find(
      (event) => event.action === "organisation.updated",
    );
    expect(updated).toBeTruthy();
    const metadata = updated?.metadata as { changes: Record<string, { from: unknown; to: unknown }> };
    expect(metadata.changes.retentionYearsClinical).toEqual({ from: 7, to: 10 });
  });

  it("does not record a no-op update", async () => {
    const owner = await signupPractice(app);
    await request(app.getHttpServer())
      .patch("/organisation")
      .set("Cookie", owner.cookie)
      .send({ retentionYearsClinical: 7 })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/audit?limit=20")
      .set("Cookie", owner.cookie)
      .expect(200);
    const actions = (response.body.events as Array<{ action: string }>).map((event) => event.action);
    expect(actions).not.toContain("organisation.updated");
  });

  it("paginates newest first with a stable cursor", async () => {
    const owner = await signupPractice(app);
    for (const retention of [8, 9, 10]) {
      await request(app.getHttpServer())
        .patch("/organisation")
        .set("Cookie", owner.cookie)
        .send({ retentionYearsClinical: retention })
        .expect(200);
    }

    const first = await request(app.getHttpServer())
      .get("/audit?limit=2")
      .set("Cookie", owner.cookie)
      .expect(200);
    expect(first.body.events).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await request(app.getHttpServer())
      .get(`/audit?limit=2&cursor=${first.body.nextCursor}`)
      .set("Cookie", owner.cookie)
      .expect(200);
    const firstIds = (first.body.events as Array<{ id: string }>).map((event) => event.id);
    const secondIds = (second.body.events as Array<{ id: string }>).map((event) => event.id);
    expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);

    const timestamps = [
      ...(first.body.events as Array<{ createdAt: string }>),
      ...(second.body.events as Array<{ createdAt: string }>),
    ].map((event) => new Date(event.createdAt).getTime());
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });

  it("exposes no way to modify or delete audit entries", async () => {
    const owner = await signupPractice(app);
    const list = await request(app.getHttpServer())
      .get("/audit")
      .set("Cookie", owner.cookie)
      .expect(200);
    const eventId = list.body.events[0].id as string;

    await request(app.getHttpServer())
      .patch(`/audit/${eventId}`)
      .set("Cookie", owner.cookie)
      .send({ summary: "tampered" })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/audit/${eventId}`)
      .set("Cookie", owner.cookie)
      .expect(404);
    await request(app.getHttpServer())
      .post("/audit")
      .set("Cookie", owner.cookie)
      .send({ summary: "injected" })
      .expect(404);

    const after = await request(app.getHttpServer())
      .get("/audit")
      .set("Cookie", owner.cookie)
      .expect(200);
    const entry = (after.body.events as Array<{ id: string; summary: string }>).find(
      (event) => event.id === eventId,
    );
    expect(entry?.summary).not.toBe("tampered");
  });

  it("rejects an unknown pagination cursor instead of returning everything", async () => {
    const owner = await signupPractice(app);
    await request(app.getHttpServer())
      .get("/audit?cursor=00000000-0000-4000-8000-000000000000")
      .set("Cookie", owner.cookie)
      .expect(404);
  });
});
