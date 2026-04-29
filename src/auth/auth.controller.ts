import { Controller, Post, Body, Get, Req, Res, UseGuards, Param, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { SignupDto, LoginDto, EmailOnlyDto, ResetPasswordDto, ContactFormDto } from './dto/auth.dto';
import { setAccessCookie, setRefreshCookie, clearAuthCookies, REFRESH_TOKEN_COOKIE } from './cookies.helper';
import type { Request, Response } from 'express';


@Controller('auth')
export class AuthController {
  private frontendUrl: string;

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  // Strict rate limit for signup: 5 per minute
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async signup(@Body() body: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.signup(body.email, body.name, body.password);
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);
    // Phase 1: still return access_token in the body so the existing
    // localStorage-based frontend keeps working. Phase 3 will drop this.
    return { access_token: accessToken };
  }

  // Strict rate limit for login: 5 per minute to prevent brute force
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.login(body.email, body.password);
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);
    return { access_token: accessToken };
  }

  // Exchange a valid refresh cookie for a new access + refresh pair.
  // Refresh cookie is path-restricted to /auth so it's only sent here and
  // on logout, not on every API request.
  @Post('refresh')
  @SkipThrottle()
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const submitted = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!submitted) {
      throw new UnauthorizedException('No refresh token');
    }
    const { accessToken, refreshToken } = await this.authService.refreshTokens(submitted);
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);
    return { access_token: accessToken };
  }

  @Post('logout')
  @SkipThrottle()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const submitted = req.cookies?.[REFRESH_TOKEN_COOKIE];
    await this.authService.logout(submitted);
    clearAuthCookies(res);
    return { success: true };
  }

  @Get('check-email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async checkEmail(@Query('email') email: string) {
    const exists = await this.authService.checkEmailExists(email);
    return { exists };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {

  }

  @Get('google/redirect')
  @SkipThrottle()
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    try {
      const { accessToken, refreshToken } = await this.authService.loginWithGoogle(req.user);
      setAccessCookie(res, accessToken);
      setRefreshCookie(res, refreshToken);
      // Phase 1: still pass the access token via URL so the existing
      // /google-success page can store it in localStorage. Phase 2 will
      // drop the token query param and rely on the cookie alone.
      res.redirect(`${this.frontendUrl}/google-success?token=${accessToken}`);
    } catch (error) {
      if (error.message === 'ACCOUNT_EXISTS_USE_PASSWORD') {
        // User exists with email/password, redirect to login with message
        res.redirect(`${this.frontendUrl}/login?error=account_exists`);
      } else {
        res.redirect(`${this.frontendUrl}/login?error=google_failed`);
      }
    }
  }

  // Email verification endpoints
  @Get('verify-email/:token')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  // Strict rate limit: 3 per minute
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resendVerification(@Body() body: EmailOnlyDto) {
    return this.authService.resendVerificationEmail(body.email);
  }

  // Password reset - strict rate limit: 3 per minute
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  forgotPassword(@Body() body: EmailOnlyDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.password);
  }

  // Contact form - rate limit: 3 per minute
  @Post('contact')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  contact(@Body() body: ContactFormDto) {
    return this.authService.sendContactForm(body.name, body.email, body.subject, body.message);
  }
}
