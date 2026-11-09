import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Prisma } from "@vetnex/database";
import { env } from "../env";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    practices?: Array<{ id: string; name: string }>;
  };
}

function defaultCodeFor(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "BAD_REQUEST";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHENTICATED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "RATE_LIMITED";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED";
  }
}

/**
 * Single error envelope for the whole API: `{ error: { code, message, ... } }`.
 *
 * Internal errors never leak stack traces, database details or query fragments to
 * the client, and request bodies are never logged.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorBody = {
      error: { code: "INTERNAL_ERROR", message: "Something went wrong on our end." },
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === "string") {
        body = { error: { code: defaultCodeFor(status), message: payload } };
      } else {
        const record = payload as Record<string, unknown>;
        const message =
          typeof record.message === "string"
            ? record.message
            : Array.isArray(record.message)
              ? record.message.join(" ")
              : "Request failed.";
        body = {
          error: {
            code: typeof record.code === "string" ? record.code : defaultCodeFor(status),
            message,
            ...(record.fieldErrors
              ? { fieldErrors: record.fieldErrors as Record<string, string[]> }
              : {}),
            ...(Array.isArray(record.practices)
              ? { practices: record.practices as Array<{ id: string; name: string }> }
              : {}),
          },
        };
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        status = HttpStatus.CONFLICT;
        body = {
          error: { code: "DUPLICATE", message: "That record already exists." },
        };
      } else if (exception.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        body = { error: { code: "NOT_FOUND", message: "That record no longer exists." } };
      } else {
        this.logger.error(
          `Database error ${exception.code} on ${request.method} ${request.path}`,
        );
      }
    } else {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (!env.isProduction && status >= 500 && !response.headersSent) {
      // Development only: surface the message so local failures are diagnosable.
      body.error.message =
        exception instanceof Error ? exception.message : body.error.message;
    }

    response.status(status).json(body);
  }
}
