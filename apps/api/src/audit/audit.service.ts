import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestMeta } from "../common/request";

export interface AuditEventInput {
  organisationId: string;
  clinicId?: string | null;
  actorUserId?: string | null;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  request?: RequestMeta;
}

export interface SerialisedAuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  actorLabel: string;
  actorUserId: string | null;
  clinicId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  requestId: string | null;
  createdAt: string;
}

/**
 * The audit trail is append-only by design. There is intentionally no update or
 * delete operation anywhere in the application, and the database grants used by
 * the API only need INSERT/SELECT on this table.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: AuditEventInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        organisationId: input.organisationId,
        clinicId: input.clinicId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorLabel: input.actorLabel,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: (input.metadata ?? undefined) as never,
        ipAddress: input.request?.ip ?? null,
        userAgent: input.request?.userAgent ?? null,
        requestId: input.request?.requestId ?? null,
      },
    });
  }

  async list(
    organisationId: string,
    params: { limit: number; cursor?: string },
  ): Promise<{ events: SerialisedAuditEvent[]; nextCursor: string | null }> {
    if (params.cursor) {
      const cursorExists = await this.prisma.auditEvent.findFirst({
        where: { id: params.cursor, organisationId },
        select: { id: true },
      });
      if (!cursorExists) {
        throw new NotFoundException({
          code: "CURSOR_NOT_FOUND",
          message: "That page of the audit trail is no longer available.",
        });
      }
    }

    const rows = await this.prisma.auditEvent.findMany({
      where: { organisationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const page = hasMore ? rows.slice(0, params.limit) : rows;
    return {
      events: page.map((row) => this.serialise(row)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  private serialise(row: {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    summary: string;
    actorLabel: string;
    actorUserId: string | null;
    clinicId: string | null;
    metadata: unknown;
    ipAddress: string | null;
    requestId: string | null;
    createdAt: Date;
  }): SerialisedAuditEvent {
    return {
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: row.summary,
      actorLabel: row.actorLabel,
      actorUserId: row.actorUserId,
      clinicId: row.clinicId,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      ipAddress: row.ipAddress,
      requestId: row.requestId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
