import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);

  // Enable CORS first (before static assets)
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://withly.co.il', 'https://www.withly.co.il'],
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

