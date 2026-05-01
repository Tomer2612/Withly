'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Notification {
  id: string;
  type: string;
  message?: string;
  isRead: boolean;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    profileImage?: string | null;
  };
}

export interface SocketMessage {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    profileImage?: string | null;
  };
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  unreadNotificationCount: number;
  unreadMessageCount: number;
  setUnreadNotificationCount: React.Dispatch<React.SetStateAction<number>>;
  setUnreadMessageCount: React.Dispatch<React.SetStateAction<number>>;
  sendMessage: (recipientId: string, content: string) => void;
  markMessagesAsRead: (conversationId: string) => void;
  setTyping: (recipientId: string, isTyping: boolean) => void;
  onNewMessage: (callback: (message: SocketMessage) => void) => void;
  onTyping: (callback: (data: { userId: string; isTyping: boolean }) => void) => void;
  onNewNotification: (callback: (notification: Notification) => void) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  
  const messageCallbackRef = useRef<((message: SocketMessage) => void) | null>(null);
  const typingCallbackRef = useRef<((data: { userId: string; isTyping: boolean }) => void) | null>(null);
  const notificationCallbackRef = useRef<((notification: Notification) => void) | null>(null);

  useEffect(() => {
    // Cookie-based auth: socket.io sends the httpOnly access cookie on
    // the handshake when withCredentials is set; the gateway parses it
    // from handshake.headers.cookie.
    //
    // socket.io ignores the path portion of the URL it's given (it only
    // uses protocol/host/port) and defaults to `/socket.io`. On prod the
    // backend lives behind Cloudflare's `/api/*` route, so we pull the
    // path prefix off NEXT_PUBLIC_API_URL and prepend it explicitly.
    // Dev (NEXT_PUBLIC_API_URL=http://localhost:4000) → path `/socket.io`.
    // Prod (NEXT_PUBLIC_API_URL=https://withly.co.il/api) → path
    // `/api/socket.io`, which Cloudflare routes to the origin and strips
    // back to `/socket.io` for the gateway.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const parsed = new URL(apiUrl);
    const apiPathPrefix = parsed.pathname.replace(/\/$/, '');
    const socket = io(parsed.origin, {
      path: `${apiPathPrefix}/socket.io`,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      // Only log in development, and only if it's not a transient error
      if (process.env.NODE_ENV === 'development') {
        console.warn('WebSocket connection error:', err.message);
      }
    });

    // Handle new notifications
    socket.on('newNotification', (notification: Notification) => {
      console.log('New notification received:', notification);
      setUnreadNotificationCount(prev => prev + 1);
      if (notificationCallbackRef.current) {
        notificationCallbackRef.current(notification);
      }
    });

    // Handle new messages
    socket.on('newMessage', (message: SocketMessage) => {
      console.log('New message received:', message);
      setUnreadMessageCount(prev => prev + 1);
      if (messageCallbackRef.current) {
        messageCallbackRef.current(message);
      }
    });

    // Handle message sent confirmation
    socket.on('messageSent', (message: SocketMessage) => {
      console.log('Message sent confirmation:', message);
      if (messageCallbackRef.current) {
        messageCallbackRef.current(message);
      }
    });

    // Handle typing indicator
    socket.on('userTyping', (data: { userId: string; isTyping: boolean }) => {
      if (typingCallbackRef.current) {
        typingCallbackRef.current(data);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const sendMessage = useCallback((recipientId: string, content: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sendMessage', { recipientId, content });
    }
  }, []);

  const markMessagesAsRead = useCallback((conversationId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('markAsRead', { conversationId });
    }
  }, []);

  const setTyping = useCallback((recipientId: string, isTyping: boolean) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', { recipientId, isTyping });
    }
  }, []);

  const onNewMessage = useCallback((callback: (message: SocketMessage) => void) => {
    messageCallbackRef.current = callback;
  }, []);

  const onTyping = useCallback((callback: (data: { userId: string; isTyping: boolean }) => void) => {
    typingCallbackRef.current = callback;
  }, []);

  const onNewNotification = useCallback((callback: (notification: Notification) => void) => {
    notificationCallbackRef.current = callback;
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        unreadNotificationCount,
        unreadMessageCount,
        setUnreadNotificationCount,
        setUnreadMessageCount,
        sendMessage,
        markMessagesAsRead,
        setTyping,
        onNewMessage,
        onTyping,
        onNewNotification,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}
