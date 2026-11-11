import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AdminBootstrapService } from './bootstrap.service';

@Module({
  controllers: [UserController],
  providers: [UserService, AdminBootstrapService],
  exports: [UserService],
})
export class UserModule {}
