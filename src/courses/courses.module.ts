import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CommunitiesModule } from '../communities/communities.module';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads/courses',
    }),
    CommunitiesModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
