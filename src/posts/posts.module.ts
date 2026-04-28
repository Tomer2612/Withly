import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunitiesModule } from '../communities/communities.module';

@Module({
  providers: [PostsService],
  controllers: [PostsController],
  imports: [NotificationsModule, CommunitiesModule]
})
export class PostsModule {}
