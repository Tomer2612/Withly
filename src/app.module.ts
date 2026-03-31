import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PrismaService } from './users/prisma.service';
import { AuthModule } from './auth/auth.module';
import { CommunitiesModule } from './communities/communities.module';
import { PostsModule } from './posts/posts.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagesModule } from './messages/messages.module';
import { CoursesModule } from './courses/courses.module';
import { StorageModule } from './common/storage.module';
import { ActivityMiddleware } from './common/activity.middleware';


@Module({
  imports: [
    // Rate limiting - more permissive for development
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 50, // 50 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 200, // 200 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 500, // 500 requests per minute
      },
    ]),
    StorageModule,
    UsersModule,
    AuthModule,
    CommunitiesModule,
    PostsModule,
    EventsModule,
    NotificationsModule,
    MessagesModule,
    CoursesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    // Apply throttler globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ActivityMiddleware).forRoutes('*');
  }
}
