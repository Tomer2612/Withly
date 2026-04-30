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
import * as jwt from 'jsonwebtoken';
import { MessagesService } from './messages.service';
import { CORS_ORIGINS } from '../common/cors';
import { getJwtSecret } from '../common/jwt.helper';
import { ACCESS_TOKEN_COOKIE } from '../auth/cookies.helper';

// socket.io's handshake doesn't go through cookie-parser, so we parse
// the raw Cookie header ourselves to find the access token.
function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(/;\s*/)) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    try {
      out[pair.slice(0, eq).trim()] = decodeURIComponent(pair.slice(eq + 1).trim());
    } catch {
      // Skip malformed cookies.
    }
  }
  return out;
}

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

  constructor(private messagesService: MessagesService) {}

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      // Pull the access token from the httpOnly cookie sent on the
      // handshake (frontend connects with withCredentials: true).
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const token = cookies[ACCESS_TOKEN_COOKIE];

      if (!token) {
        socket.disconnect();
        return;
      }

      // Verify JWT using jsonwebtoken directly
      const payload = jwt.verify(token, getJwtSecret()) as { sub: string };
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
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to send message' };
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

  // Utility method to send a notification to a user (called from NotificationsService).
  // Payload is passed straight through to socket.io which serializes to JSON, so
  // unknown is the honest type — we don't look inside, callers do.
  sendNotificationToUser(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit('newNotification', notification);
  }

  // Utility method to send a message to a user (called from MessagesController).
  sendMessageToUser(userId: string, message: unknown) {
    this.server.to(`user:${userId}`).emit('newMessage', message);
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }
}
