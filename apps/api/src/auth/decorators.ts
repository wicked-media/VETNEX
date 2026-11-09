import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthContext } from "../auth/auth.types";

export const IS_PUBLIC_KEY = "vetnex:isPublic";
export const PERMISSIONS_KEY = "vetnex:permissions";

/** Marks a route as reachable without a session (login, signup, invitation lookup). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Requires every listed permission. Enforced by PermissionsGuard. */
export const RequirePermission = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export interface RequestWithAuth extends Request {
  auth?: AuthContext;
}

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.auth) {
      throw new Error("CurrentAuth used on a route that is not authenticated");
    }
    return request.auth;
  },
);
