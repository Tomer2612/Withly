import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { SendMessageDto } from './dto/messages.dto';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  // Get all conversations (inbox)
  @UseGuards(AuthGuard('jwt'))
  @Get('conversations')
  async getConversations(@Req() req) {
    return this.messagesService.getConversations(req.user.userId);
  }

  // Get unread message count
  @UseGuards(AuthGuard('jwt'))
  @Get('unread-count')
  async getUnreadCount(@Req() req) {
    return this.messagesService.getUnreadCount(req.user.userId);
  }

  // Mark all messages as read (must be before parameterized routes)
  @UseGuards(AuthGuard('jwt'))
  @Post('read-all')
  async markAllAsRead(@Req() req) {
    await this.messagesService.markAllAsRead(req.user.userId);
    return { success: true };
  }

  // Get or create conversation with a user
  @UseGuards(AuthGuard('jwt'))
  @Post('conversations/:userId')
  async getOrCreateConversation(@Req() req, @Param('userId') otherUserId: string) {
    return this.messagesService.getOrCreateConversation(req.user.userId, otherUserId);
  }

  // Get messages in a conversation
  @UseGuards(AuthGuard('jwt'))
  @Get('conversations/:conversationId/messages')
  async getMessages(
    @Req() req,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.messagesService.getMessages(
      conversationId,
      req.user.userId,
      Math.min(limit ? parseInt(limit) : 50, 100),
      offset ? parseInt(offset) : 0,
    );
  }

  // Send a message (REST fallback, WebSocket preferred)
  @UseGuards(AuthGuard('jwt'))
  @Post('send')
  async sendMessage(
    @Req() req,
    @Body() body: SendMessageDto,
  ) {
    const message = await this.messagesService.sendMessage(req.user.userId, body.recipientId, body.content);
    
    // Emit to recipient via WebSocket for real-time delivery
    this.messagesGateway.sendMessageToUser(body.recipientId, message);
    
    return message;
  }

  // Mark conversation as read
  @UseGuards(AuthGuard('jwt'))
  @Post('conversations/:conversationId/read')
  async markAsRead(@Req() req, @Param('conversationId') conversationId: string) {
    await this.messagesService.markConversationAsRead(conversationId, req.user.userId);
    return { success: true };
  }

  // Check if conversation exists with a user
  @UseGuards(AuthGuard('jwt'))
  @Get('has-conversation/:userId')
  async hasConversation(@Req() req, @Param('userId') otherUserId: string) {
    const hasConversation = await this.messagesService.hasConversation(req.user.userId, otherUserId);
    return { hasConversation };
  }
}
