import { Global, Module } from '@nestjs/common';
import { ReferenceController } from './reference.controller';
import { ExerciseService } from './exercise.service';
import { VerifyController } from './verify.controller';

@Global()
@Module({ controllers: [ReferenceController, VerifyController], providers: [ExerciseService], exports: [ExerciseService] })
export class ReferenceModule {}
