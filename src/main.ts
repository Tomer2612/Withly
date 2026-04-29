import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { CORS_ORIGINS } from './common/cors';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);

  // Single global exception filter so every error response shares one shape.
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  // Global validation: every @Body / @Query / @Param goes through this.
  // - whitelist strips fields that aren't on the DTO (defense in depth)
  // - forbidNonWhitelisted rejects requests that include unknown fields
  // - transform applies @Type() conversions (e.g. multipart string -> number)
  // - transformOptions.enableImplicitConversion casts primitive query
  //   params (string '5' -> number 5) without an explicit @Type
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

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

