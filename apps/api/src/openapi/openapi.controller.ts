import { Controller, Get, Header } from "@nestjs/common";
import { Public } from "../auth/decorators";
import { buildOpenApiDocument } from "./document";

/**
 * Serves the machine-readable contract. Public on purpose: it contains no tenant
 * data, and API clients need it before they can authenticate.
 */
@Controller()
export class OpenApiController {
  private document: Record<string, unknown> | null = null;

  @Public()
  @Get("openapi.json")
  @Header("cache-control", "public, max-age=300")
  get(): Record<string, unknown> {
    this.document ??= buildOpenApiDocument();
    return this.document;
  }
}
