import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAllPermissions } from "@vetnex/permissions";
import { PERMISSIONS_KEY, type RequestWithAuth } from "./decorators";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.auth) {
      throw new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "Sign in to continue.",
      });
    }

    if (!hasAllPermissions(request.auth.permissions, required)) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Your role does not have permission to do that.",
      });
    }
    return true;
  }
}
