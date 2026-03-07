import { Injectable, UnauthorizedException, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../users/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
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

      // Send verification email
      try {
        await this.emailService.sendVerificationEmail(email, name, verificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Continue with signup even if email fails
      }

      return this.signToken(user.id, user.email);
    } catch (error) {
      console.error('Signup error:', error);
      throw new InternalServerErrorException('Signup failed');
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Incorrect password');
    }

    return this.signToken(user.id, user.email);
  }

  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return !!user;
  }

  async loginWithGoogle(googleUser: any) {
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

      // Send welcome email (non-blocking)
      this.emailService.sendWelcomeEmail(user.email, user.name).catch(console.error);
    }

    const payload = { email: user.email, sub: user.id };
    return this.jwtService.sign(payload);
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
      return { message: 'Contact form submitted successfully' };
    } catch (error) {
      console.error('Failed to send contact email:', error);
      // Still return success to user - we don't want to expose email issues
      return { message: 'Contact form submitted successfully' };
    }
  }

  private signToken(userId: string, email: string) {
    const payload = { sub: userId, email };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}