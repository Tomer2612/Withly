import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { CORS_ORIGINS } from './common/cors';

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);

  // Helmet sets security-hardening response headers (X-Frame-Options,
  // X-Content-Type-Options, HSTS, default CSP, etc). Override the default
  // Cross-Origin-Resource-Policy so /uploads/* served from the API origin
  // can be loaded by the frontend at a different port/origin.
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // Enable CORS first (before static assets)
  app.enableCors({
    origin: CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  // Serve static files with CORS headers
  app.useStaticAssets('uploads', { 
    prefix: '/uploads',
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET');
    }
  });
  
  await app.listen(4000);
}
bootstrap();

