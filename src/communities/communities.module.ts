import { Module } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CommunitiesController } from './communities.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  providers: [CommunitiesService],
  controllers: [CommunitiesController],
  imports: [NotificationsModule],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
