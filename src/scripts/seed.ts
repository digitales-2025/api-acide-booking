import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedsService } from '../modules/seeds/seeds.service';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function runSeeds() {
  // Crear contexto de aplicación completo (no solo ApplicationContext)
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'], // Reducir logs durante seed
  });

  // Configurar middlewares necesarios para Better Auth
  app.use(cookieParser());

  const seedsService = app.get(SeedsService);
  const logger = new Logger('SeedScript');

  try {
    logger.log('🌱 Iniciando ejecución de seeds...');
    logger.log('⚙️ Configurando Better Auth para seeds...');

    const result = await seedsService.generateInit();
    logger.log('✅ Seeds ejecutados exitosamente');
    logger.log('📊 Resultado:', JSON.stringify(result, null, 2));
  } catch (error) {
    logger.error('❌ Error ejecutando seeds:', error.message);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runSeeds();
