import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  acceptInvitationSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@vetnex/shared";
import { parseInput } from "../common/zod";
import { requestMeta } from "../common/request";
import { env } from "../env";
import { AuthService, type InvitationView } from "./auth.service";
import { toSessionPayload, type AuthContext } from "./auth.types";
import { CurrentAuth, Public, type RequestWithAuth } from "./decorators";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post("signup")
  @HttpCode(201)
  async signup(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = parseInput(signupSchema, body);
    const { token, auth } = await this.authService.signup(input, requestMeta(request));
    this.setSessionCookie(response, token);
    return toSessionPayload(auth);
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = parseInput(loginSchema, body);
    const { token, auth } = await this.authService.login(input, requestMeta(request));
    this.setSessionCookie(response, token);
    return toSessionPayload(auth);
  }

  @Public()
  @Get("session")
  session(@Req() request: RequestWithAuth, @Res() response: Response) {
    // Written explicitly: Nest treats a `null` return value as an empty body, and the
    // client relies on a literal `null` JSON document to mean "not signed in".
    response.status(200).json(request.auth ? toSessionPayload(request.auth) : null);
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  async logout(
    @Req() request: RequestWithAuth,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(request.auth ?? null, requestMeta(request));
    response.clearCookie(env.sessionCookieName, { path: "/" });
    return { ok: true };
  }

  @Get("sessions")
  listSessions(@CurrentAuth() auth: AuthContext) {
    return this.authService.listSessions(auth);
  }

  @Delete("sessions/:id")
  async revokeSession(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    await this.authService.revokeSession(auth, id);
    return { ok: true };
  }

  @Public()
  @Post("password/forgot")
  @HttpCode(202)
  async forgotPassword(@Body() body: unknown, @Req() request: Request) {
    const input = parseInput(forgotPasswordSchema, body);
    return this.authService.requestPasswordReset(input, requestMeta(request));
  }

  @Public()
  @Post("password/reset")
  @HttpCode(200)
  async resetPassword(@Body() body: unknown, @Req() request: Request) {
    const input = parseInput(resetPasswordSchema, body);
    return this.authService.resetPassword(input, requestMeta(request));
  }

  @Public()
  @Get("invitation/:token")
  getInvitation(@Param("token") token: string): Promise<InvitationView> {
    return this.authService.getInvitation(token);
  }

  @Public()
  @Post("invitation/:token/accept")
  @HttpCode(200)
  async acceptInvitation(
    @Param("token") token: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = parseInput(acceptInvitationSchema, body);
    const { token: sessionToken, auth } = await this.authService.acceptInvitation(
      token,
      input,
      requestMeta(request),
    );
    this.setSessionCookie(response, sessionToken);
    return toSessionPayload(auth);
  }

  private setSessionCookie(response: Response, token: string): void {
    response.cookie(env.sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.cookieSecure,
      path: "/",
      maxAge: env.sessionTtlHours * 60 * 60 * 1000,
    });
  }
}
