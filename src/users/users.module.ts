import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { StorageModule } from '../common/storage.module';
import { CommunitiesModule } from '../communities/communities.module';

@Module({
  imports: [NotificationsModule, EmailModule, StorageModule, forwardRef(() => CommunitiesModule)],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
