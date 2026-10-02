import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminApplicantsController, AdminAuthController, AdminExercisesController, AdminMiscController } from './admin.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminService } from './admin.service';
import { ApplicantsService } from './applicants.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminAuthController, AdminApplicantsController, AdminExercisesController, AdminMiscController],
  providers: [AdminAuthService, AdminService, ApplicantsService],
})
export class AdminModule {}
