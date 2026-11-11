import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../core/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth-provider.interface';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentDto } from './dto/comment-response.dto';
import { CommentCountDto } from './dto/comment-count.dto';

/**
 * Comments on a request — a conversation anyone who can open the detail
 * (creator, viewer, or flow assignee) can take part in. `stepOrder` scopes a
 * comment to an approval step's thread; omitting it targets the request feed.
 */
@ApiTags('comments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('requests/:requestId/comments')
export class CommentController {
  constructor(private readonly comments: CommentService) {}

  @Get()
  @ApiOperation({
    summary: "List a request's comments (threaded)",
    description:
      'Pass ?stepOrder= to fetch a step thread; omit it for the request-level feed.',
  })
  @ApiParam({ name: 'requestId', description: 'Request id' })
  @ApiQuery({ name: 'stepOrder', required: false, type: Number })
  @ApiOkResponse({ type: CommentDto, isArray: true })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Query('stepOrder', new ParseIntPipe({ optional: true }))
    stepOrder?: number,
  ): Promise<CommentDto[]> {
    return this.comments.list(user.userId, requestId, stepOrder);
  }

  @Get('counts')
  @ApiOperation({
    summary: 'Comment counts grouped by step (and the request feed)',
    description:
      'Returns one entry per scope: stepOrder (null = request feed) and the number of non-deleted comments.',
  })
  @ApiParam({ name: 'requestId', description: 'Request id' })
  @ApiOkResponse({ type: CommentCountDto, isArray: true })
  counts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
  ): Promise<CommentCountDto[]> {
    return this.comments.counts(user.userId, requestId);
  }

  @Post()
  @ApiOperation({ summary: 'Post a comment, reply, or step note' })
  @ApiParam({ name: 'requestId', description: 'Request id' })
  @ApiCreatedResponse({ type: CommentDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentDto> {
    return this.comments.create(user.userId, requestId, dto);
  }

  @Patch(':commentId')
  @ApiOperation({ summary: 'Edit a comment (author only)' })
  @ApiParam({ name: 'requestId', description: 'Request id' })
  @ApiParam({ name: 'commentId', description: 'Comment id' })
  @ApiOkResponse({ type: CommentDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentDto> {
    return this.comments.update(user.userId, requestId, commentId, dto.body);
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment (author or admin)' })
  @ApiParam({ name: 'requestId', description: 'Request id' })
  @ApiParam({ name: 'commentId', description: 'Comment id' })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    return this.comments.remove(user.userId, user.role, requestId, commentId);
  }

  @Post(':commentId/like')
  @ApiOperation({ summary: "Toggle the caller's like on a comment" })
  @ApiParam({ name: 'requestId', description: 'Request id' })
  @ApiParam({ name: 'commentId', description: 'Comment id' })
  @ApiOkResponse({ type: CommentDto })
  toggleLike(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Param('commentId') commentId: string,
  ): Promise<CommentDto> {
    return this.comments.toggleLike(user.userId, requestId, commentId);
  }
}
