import { Injectable, UnauthorizedException, ForbiddenException, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  // Real bcrypt hash compared against on no-user logins to keep response
  // time consistent — prevents existence enumeration via timing.
  private readonly dummyHashPromise = bcrypt.hash('login-timing-equalizer', 10);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async signup(email: string, name: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
        },
      });

      // Send verification email - don't fail signup if email fails
      try {
        await this.emailService.sendVerificationEmail(email, name, verificationToken);
      } catch {
        // Email send failed, continue with signup
      }

      return this.issueTokens(user.id, user.email);
    } catch {
      throw new InternalServerErrorException('Signup failed');
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const hashToCompare = user?.password ?? (await this.dummyHashPromise);
    const isMatch = await bcrypt.compare(password, hashToCompare);
    if (!user || !isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Block login until the email is verified. Safe to reveal at this point —
    // the caller already proved they know the password, so we're not leaking
    // existence to a random attacker.
    if (!user.isEmailVerified) {
      throw new ForbiddenException('Email not verified');
    }

    return this.issueTokens(user.id, user.email);
  }

  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return !!user;
  }

  async loginWithGoogle(googleUser: { email: string; name: string; picture: string | null; provider: string }) {
    // Check if user already exists with this email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (existingUser) {
      // If user exists but doesn't have googleId, they registered with email/password
      // Tell them to login with their password instead
      if (!existingUser.googleId) {
        throw new BadRequestException('ACCOUNT_EXISTS_USE_PASSWORD');
      }
      // User exists and has googleId - they originally signed up with Google, allow login
    }

    let user = existingUser;

    if (!user) {
      // Create new user with Google - email is automatically verified
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name || googleUser.email.split('@')[0],
          password: '', // No password for Google users
          googleId: googleUser.email,
          profileImage: googleUser.picture || null,
          isEmailVerified: true, // Google users are verified
        },
      });

      // Send welcome email (non-blocking, fire and forget)
      this.emailService.sendWelcomeEmail(user.email, user.name).catch(() => {});
    }

    return this.issueTokens(user.id, user.email);
  }

  // Verify email with token
  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  // Resend verification email
  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    await this.emailService.sendVerificationEmail(email, user.name, verificationToken);

    return { message: 'Verification email sent' };
  }

  // Request password reset
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Don't allow password reset for Google-only users
    if (user.googleId && !user.password) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    await this.emailService.sendPasswordResetEmail(email, user.name, resetToken);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  // Reset password with token
  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid reset token');
    }

    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async sendContactForm(name: string, email: string, subject: string, message: string) {
    try {
      await this.emailService.sendContactEmail(name, email, subject, message);
    } catch {
      // Don't expose email issues to user
    }
    return { message: 'Contact form submitted successfully' };
  }

  // Access tokens are short-lived stateless JWTs. The 15m expiry caps the
  // blast radius of a leaked token; the frontend rotates them silently via
  // /auth/refresh whenever an API call 401s.
  private signAccessToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email }, { expiresIn: '15m' });
  }

  // Refresh tokens are random 32-byte values stored in DB by sha256 hash so
  // a leaked DB doesn't yield usable tokens. sha256 (not bcrypt) because the
  // input is already high-entropy random — slow hashing buys nothing.
  private async createRefreshToken(userId: string): Promise<{ id: string; token: string }> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const row = await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
    return { id: row.id, token };
  }

  async issueTokens(userId: string, email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.signAccessToken(userId, email);
    const { token: refreshToken } = await this.createRefreshToken(userId);
    return { accessToken, refreshToken };
  }

  async refreshTokens(submitted: string): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = crypto.createHash('sha256').update(submitted).digest('hex');
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!row) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Replay defence: a token that's been replaced or revoked is being
    // submitted by a stolen-token holder. Burn every active refresh token
    // for this user so the attacker AND the legitimate session both lose.
    if (row.revokedAt || row.replacedById) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (row.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const { id: newId, token: newToken } = await this.createRefreshToken(row.userId);
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date(), replacedById: newId },
    });

    return {
      accessToken: this.signAccessToken(row.user.id, row.user.email),
      refreshToken: newToken,
    };
  }

  async logout(submitted: string | undefined): Promise<void> {
    if (!submitted) return;
    const tokenHash = crypto.createHash('sha256').update(submitted).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}