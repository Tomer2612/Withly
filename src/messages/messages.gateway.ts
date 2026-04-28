import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { MessagesService } from './messages.service';
import { CORS_ORIGINS } from '../common/cors';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: CORS_ORIGINS,
    credentials: true,
  },
  namespace: '/',
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map userId to socket ids (a user can have multiple tabs open)
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private configService: ConfigService,
    private messagesService: MessagesService,
  ) {}

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      // Get token from auth header or query
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      
      if (!token) {
        socket.disconnect();
        return;
      }

      // Verify JWT using jsonwebtoken directly
      const secret = this.configService.get<string>('JWT_SECRET') as string;
      const payload = jwt.verify(token as string, secret) as { sub: string };
      const userId = payload.sub as string;
      socket.userId = userId;

      // Add socket to user's socket set
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      // Join a room with user's ID for targeted messages
      socket.join(`user:${userId}`);
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    if (socket.userId) {
      const userSocketSet = this.userSockets.get(socket.userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(socket.userId);
        }
      }
    }
  }

  // Send a direct message
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { recipientId: string; content: string },
  ) {
    if (!socket.userId) {
      return { error: 'Not authenticated' };
    }

    try {
      const message = await this.messagesService.sendMessage(
        socket.userId,
        data.recipientId,
        data.content,
      );

      // Emit to recipient's room
      this.server.to(`user:${data.recipientId}`).emit('newMessage', message);
      
      // Also emit back to sender (for multi-tab sync)
      this.server.to(`user:${socket.userId}`).emit('messageSent', message);

      return { success: true, message };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  // Mark messages as read
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!socket.userId) {
      return { error: 'Not authenticated' };
    }

    try {
      await this.messagesService.markConversationAsRead(data.conversationId, socket.userId);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // Typing indicator
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { recipientId: string; isTyping: boolean },
  ) {
    if (!socket.userId) return;

    this.server.to(`user:${data.recipientId}`).emit('userTyping', {
      userId: socket.userId,
      isTyping: data.isTyping,
    });
  }

  // Utility method to send a notification to a user (called from NotificationsService)
  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('newNotification', notification);
  }

  // Utility method to send a message to a user (called from MessagesController)
  sendMessageToUser(userId: string, message: any) {
    this.server.to(`user:${userId}`).emit('newMessage', message);
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }
}
