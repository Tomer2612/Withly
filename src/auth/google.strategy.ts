// src/auth/strategies/google.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || '',
      scope: ['email', 'profile'],
    });
  }

  authenticate(req: Request, options?: { prompt?: string }) {
    super.authenticate(req, { ...options, prompt: 'select_account' });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { name, emails, photos } = profile;
    const email = emails?.[0]?.value;
    if (!email) {
      done(new Error('Google profile missing email'), undefined);
      return;
    }
    const user = {
      email,
      name: name?.givenName || name?.familyName || email.split('@')[0],
      picture: photos?.[0]?.value || null,
      provider: 'google',
    };
    done(null, user);
  }
}
