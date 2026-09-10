import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Restrict cross-origin requests to the web app's origin. Falls back to
  // localhost:3000 (Next.js dev default) so local dev works without an
  // ALLOWED_ORIGIN env var set. See apps/api/.env.example.
  app.enableCors({
    origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000',
  });

  const port = process.env.PORT ?? 8080;
  await app.listen(port);
}
await bootstrap();
