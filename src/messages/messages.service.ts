import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  // Check if a conversation exists between two users
  async hasConversation(userId1: string, userId2: string): Promise<boolean> {
    const [participant1Id, participant2Id] = [userId1, userId2].sort();
    
    const conversation = await this.prisma.conversation.findUnique({
      where: {
        participant1Id_participant2Id: { participant1Id, participant2Id },
      },
      select: { id: true },
    });
    
    return !!conversation;
  }

  // Get or create a conversation between two users
  async getOrCreateConversation(userId1: string, userId2: string) {
    // Always order IDs to ensure consistent uniqueness
    const [participant1Id, participant2Id] = [userId1, userId2].sort();

    // Try to find existing conversation
    let conversation = await this.prisma.conversation.findUnique({
      where: {
        participant1Id_participant2Id: { participant1Id, participant2Id },
      },
      include: {
        participant1: {
          select: { id: true, name: true, profileImage: true },
        },
        participant2: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });

    // Create if doesn't exist
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { participant1Id, participant2Id },
        include: {
          participant1: {
            select: { id: true, name: true, profileImage: true },
          },
          participant2: {
            select: { id: true, name: true, profileImage: true },
          },
        },
      });
    }

    return conversation;
  }

  // Send a message
  async sendMessage(senderId: string, recipientId: string, content: string) {
    // Get or create conversation
    const conversation = await this.getOrCreateConversation(senderId, recipientId);

    // Create the message
    const message = await this.prisma.message.create({
      data: {
        content,
        senderId,
        conversationId: conversation.id,
      },
      include: {
        sender: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });

    // Update conversation with last message info
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.createdAt,
        lastMessageText: content.length > 100 ? content.slice(0, 100) + '...' : content,
      },
    });

    return {
      ...message,
      conversationId: conversation.id,
      recipientId,
    };
  }

  // Get user's conversations (inbox)
  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [
          { participant1Id: userId },
          { participant2Id: userId },
        ],
      },
      include: {
        participant1: {
          select: { id: true, name: true, profileImage: true },
        },
        participant2: {
          select: { id: true, name: true, profileImage: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // Get all unread counts in a single query using groupBy
    const unreadCounts = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversations.map(c => c.id) },
        senderId: { not: userId },
        isRead: false,
      },
      _count: { id: true },
    });

    // Create a map for quick lookup
    const unreadMap = new Map(unreadCounts.map(u => [u.conversationId, u._count.id]));

    return conversations.map(conv => ({
      id: conv.id,
      participant1: conv.participant1,
      participant2: conv.participant2,
      lastMessage: conv.messages[0] || null,
      lastMessageAt: conv.lastMessageAt,
      lastMessageText: conv.lastMessageText,
      unreadCount: unreadMap.get(conv.id) || 0,
    }));
  }

  // Get messages in a conversation
  async getMessages(conversationId: string, userId: string, limit = 50, offset = 0) {
    // Verify user is part of conversation and get participant info
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { participant1Id: userId },
          { participant2Id: userId },
        ],
      },
      include: {
        participant1: {
          select: { id: true, name: true, profileImage: true },
        },
        participant2: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found or access denied');
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: { id: true, name: true, profileImage: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Return in chronological order with conversation info
    return {
      conversation,
      messages: messages.reverse(),
    };
  }

  // Mark messages as read
  async markConversationAsRead(conversationId: string, userId: string) {
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  // Mark all messages as read
  async markAllAsRead(userId: string) {
    await this.prisma.message.updateMany({
      where: {
        conversation: {
          OR: [
            { participant1Id: userId },
            { participant2Id: userId },
          ],
        },
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  // Get total unread message count
  async getUnreadCount(userId: string) {
    // Count distinct *conversations* with unread messages, not the total
    // unread message count. Standard chat-app pattern (Discord/Slack/etc):
    // bell shows how many people have pinged you, the per-row badge in the
    // dropdown shows how many messages from each.
    const rows = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversation: {
          OR: [
            { participant1Id: userId },
            { participant2Id: userId },
          ],
        },
        senderId: { not: userId },
        isRead: false,
      },
    });
    return { unreadCount: rows.length };
  }

  // Get conversation with a specific user
  async getConversationWithUser(currentUserId: string, otherUserId: string) {
    const [participant1Id, participant2Id] = [currentUserId, otherUserId].sort();
    
    return this.prisma.conversation.findUnique({
      where: {
        participant1Id_participant2Id: { participant1Id, participant2Id },
      },
      include: {
        participant1: {
          select: { id: true, name: true, profileImage: true },
        },
        participant2: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });
  }
}
