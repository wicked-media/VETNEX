import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { env } from "../env";
import { readCookie } from "../common/request";
import { AuthService } from "./auth.service";
import { IS_PUBLIC_KEY, type RequestWithAuth } from "./decorators";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Global authentication guard.
 *
 *  * Resolves the session cookie (or a Bearer token for service clients).
 *  * Attaches the tenant-scoped AuthContext to the request.
 *  * Rejects state-changing requests whose Origin is not the serving host or an
 *    explicitly allowed origin. Cookies are SameSite=Lax as well, so this is
 *    defence in depth rather than the only control.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    this.assertTrustedOrigin(request);

    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    const token =
      readCookie(request.headers.cookie, env.sessionCookieName) ?? this.readBearer(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "Sign in to continue.",
      });
    }

    const auth = await this.authService.resolveAuth(token);
    if (!auth) {
      if (isPublic) return true;
      throw new UnauthorizedException({
        code: "SESSION_EXPIRED",
        message: "Your session has ended. Sign in again.",
      });
    }

    request.auth = auth;
    return true;
  }

  private readBearer(request: Request): string | null {
    const header = firstHeader(request.headers.authorization);
    if (!header || !header.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length).trim();
    return token.length > 0 ? token : null;
  }

  private assertTrustedOrigin(request: Request): void {
    if (SAFE_METHODS.has(request.method)) return;
    const origin = firstHeader(request.headers.origin);
    // Non-browser clients and server-side rendering omit Origin entirely; those
    // requests are not subject to browser-driven CSRF.
    if (!origin) return;

    const forwardedHost = firstHeader(request.headers["x-forwarded-host"]);
    const host = forwardedHost ?? firstHeader(request.headers.host);

    try {
      const originUrl = new URL(origin);
      if (host && originUrl.host === host) return;
      if (env.corsOrigins.includes(origin)) return;
      if (env.corsOrigins.includes(originUrl.origin)) return;
    } catch {
      // fall through to rejection
    }

    throw new ForbiddenException({
      code: "UNTRUSTED_ORIGIN",
      message: "Request blocked: untrusted origin.",
    });
  }
}
