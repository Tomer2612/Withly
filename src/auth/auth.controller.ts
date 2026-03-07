import { Controller, Post, Body, Get, Req, Res, UseGuards, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';


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
  signup(@Body() body: { email: string; name: string; password: string }) {
    console.log('Received signup body:', body);
    return this.authService.signup(body.email, body.name, body.password);
  }

  // Strict rate limit for login: 5 per minute to prevent brute force
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() body: { email: string; password: string }) {
    console.log('Received login body:', body);
    return this.authService.login(body.email, body.password);
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
  async googleAuthRedirect(@Req() req, @Res() res) {
    try {
      const token = await this.authService.loginWithGoogle(req.user);
      res.redirect(`${this.frontendUrl}/google-success?token=${token}`);
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
  resendVerification(@Body() body: { email: string }) {
    return this.authService.resendVerificationEmail(body.email);
  }

  // Password reset - strict rate limit: 3 per minute
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }

  // Contact form - rate limit: 3 per minute
  @Post('contact')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  contact(@Body() body: { name: string; email: string; subject: string; message: string }) {
    return this.authService.sendContactForm(body.name, body.email, body.subject, body.message);
  }
}