import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { PrismaService } from '../common/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway, PrismaService],
  exports: [MessagesService, MessagesGateway],
})
export class MessagesModule {}
