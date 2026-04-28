import { Module } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CommunitiesController } from './communities.controller';
import { UsersModule } from '../users/users.module';
import { PrismaService } from '../common/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  providers: [CommunitiesService, PrismaService],
  controllers: [CommunitiesController],
  imports: [UsersModule, NotificationsModule],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
