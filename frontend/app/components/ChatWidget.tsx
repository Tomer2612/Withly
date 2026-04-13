'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useSocketContext, SocketMessage } from '../lib/SocketContext';
import { getImageUrl } from '@/app/lib/imageUrl';

interface Message {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    profileImage: string | null;
  };
}

interface Conversation {
  id: string;
  participant1: { id: string; name: string; profileImage: string | null };
  participant2: { id: string; name: string; profileImage: string | null };
  lastMessageAt: string;
  lastMessageText: string | null;
  unreadCount?: number;
}

interface OpenChat {
  conversationId: string;
  recipientId: string;
  recipientName: string;
  recipientImage: string | null;
  messages: Message[];
  isMinimized: boolean;
  isLoading: boolean;
}

export default function ChatWidget() {
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const conversationsRef = useRef<HTMLDivElement>(null);
  const justMarkedAllReadRef = useRef(false);
  
  // Ref to store the showConversations setter - avoids stale closure in window.toggleChatWidget
  const showConversationsRef = useRef(showConversations);
  const setShowConversationsRef = useRef(setShowConversations);
  
  // Keep refs in sync
  useEffect(() => {
    showConversationsRef.current = showConversations;
  }, [showConversations]);
  
  const { onNewMessage } = useSocketContext();

  // Check auth status
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoggedIn(false);
        setAuthChecked(true);
        setCurrentUserId(null);
        return;
      }
      setIsLoggedIn(true);
      setAuthChecked(true);

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.sub);
      } catch {
        console.error('Failed to decode token');
      }
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    // Skip fetch if we just marked all as read
    if (justMarkedAllReadRef.current) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoadingConversations(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  // Store fetchConversations in a ref to avoid stale closures
  const fetchConversationsRef = useRef(fetchConversations);
  useEffect(() => {
    fetchConversationsRef.current = fetchConversations;
  }, [fetchConversations]);

  // Expose toggle function globally - bypasses event listener issues
  useEffect(() => {
    const toggle = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        (window as any).chatWidgetOpenIntent = true;
        return;
      }
      
      const currentlyShowing = showConversationsRef.current;
      if (!currentlyShowing) {
        fetchConversationsRef.current();
      }
      
      showConversationsRef.current = !currentlyShowing;
      setShowConversationsRef.current(!currentlyShowing);
    };

    // 1. Assign to window so MessagesBell can call it directly
    (window as any).toggleChatWidget = toggle;

    // Check for pending intent (race condition fix)
    const token = localStorage.getItem('token');
    if ((window as any).chatWidgetOpenIntent && token) {
      showConversationsRef.current = true;
      setShowConversationsRef.current(true);
      fetchConversationsRef.current();
      (window as any).chatWidgetOpenIntent = false;
    }

    return () => {
      // Cleanup on unmount
      if ((window as any).toggleChatWidget === toggle) {
        delete (window as any).toggleChatWidget;
      }
    };
  }, []);

  // Handle "Open Intent" when Auth becomes ready
  useEffect(() => {
    if (authChecked && isLoggedIn && (window as any).chatWidgetOpenIntent) {
      setShowConversations(true);
      fetchConversationsRef.current();
      (window as any).chatWidgetOpenIntent = false;
    }
  }, [authChecked, isLoggedIn]);

  // Close conversations dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Ignore clicks on the messages bell button (let toggle handle it)
      if (target.closest('[data-messages-bell]')) {
        return;
      }
      if (conversationsRef.current && !conversationsRef.current.contains(target)) {
        setShowConversations(false);
      }
    };

    if (showConversations) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showConversations]);

  // Listen for new messages
  useEffect(() => {
    onNewMessage((socketMessage: SocketMessage) => {
      setOpenChats(prev => prev.map(chat => {
        if (chat.conversationId === socketMessage.conversationId) {
          const message: Message = {
            ...socketMessage,
            sender: {
              ...socketMessage.sender,
              profileImage: socketMessage.sender.profileImage || null,
            },
          };
          return { ...chat, messages: [...chat.messages, message] };
        }
        return chat;
      }));
    });
  }, [onNewMessage]);

  const openChat = useCallback(async (conv: Conversation) => {
    // Get userId from token directly to avoid stale state
    const token = localStorage.getItem('token');
    if (!token) return;
    
    let userId = currentUserId;
    if (!userId) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
      } catch {
        return;
      }
    }
    if (!userId) return;
    
    const other = conv.participant1.id === userId ? conv.participant2 : conv.participant1;
    
    // Check if already open
    const existingChat = openChats.find(c => c.conversationId === conv.id);
    if (existingChat) {
      setOpenChats(prev => prev.map(c => 
        c.conversationId === conv.id ? { ...c, isMinimized: false } : c
      ));
      return;
    }

    // Add new chat window
    const newChat: OpenChat = {
      conversationId: conv.id,
      recipientId: other.id,
      recipientName: other.name,
      recipientImage: other.profileImage,
      messages: [],
      isMinimized: false,
      isLoading: true,
    };

    // Smart chat limits: Max 3 expanded, Max 5 minimized
    setOpenChats(prev => {
      const expanded = prev.filter(c => !c.isMinimized);
      const minimized = prev.filter(c => c.isMinimized);
      
      // If we have 3 expanded chats, auto-minimize the oldest expanded one
      if (expanded.length >= 3) {
        const oldestExpanded = expanded[0];
        const newExpanded = expanded.slice(1);
        const updatedMinimized = [...minimized, { ...oldestExpanded, isMinimized: true }];
        
        // If minimized exceeds 8, remove the oldest minimized
        const finalMinimized = updatedMinimized.length > 8 ? updatedMinimized.slice(1) : updatedMinimized;
        
        return [...finalMinimized, ...newExpanded, newChat];
      }
      
      // If minimized exceeds 8, remove the oldest minimized
      const finalMinimized = minimized.length > 8 ? minimized.slice(1) : minimized;
      
      return [...finalMinimized, ...expanded, newChat];
    });

    // Fetch messages
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/conversations/${conv.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOpenChats(prev => prev.map(c => 
          c.conversationId === conv.id 
            ? { ...c, messages: data.messages || [], isLoading: false }
            : c
        ));

        // Mark as read
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/conversations/${conv.id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        
        // Immediately trigger refresh of unread count in MessagesBell
        window.dispatchEvent(new Event('conversationRead'));
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [currentUserId, openChats]);

  // Listen for openChat events from ChatBell
  useEffect(() => {
    const handleOpenChat = (event: CustomEvent<Conversation>) => {
      openChat(event.detail);
    };

    window.addEventListener('openChat', handleOpenChat as EventListener);
    return () => {
      window.removeEventListener('openChat', handleOpenChat as EventListener);
    };
  }, [openChat]);

  // Open chat with a user directly (called from profile)
  const startChatWithUser = useCallback(async (userId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/conversations/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const conv = await res.json();
        const fakeConv: Conversation = {
          id: conv.id,
          participant1: conv.participant1,
          participant2: conv.participant2,
          lastMessageAt: conv.lastMessageAt || new Date().toISOString(),
          lastMessageText: null,
        };
        openChat(fakeConv);
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  }, [openChat]);

  // Expose startChatWithUser globally
  useEffect(() => {
    (window as any).openChatWithUser = startChatWithUser;
    return () => {
      delete (window as any).openChatWithUser;
    };
  }, [startChatWithUser]);

  const closeChat = (conversationId: string) => {
    setOpenChats(prev => prev.filter(c => c.conversationId !== conversationId));
  };

  const toggleMinimize = (conversationId: string) => {
    setOpenChats(prev => prev.map(c => 
      c.conversationId === conversationId ? { ...c, isMinimized: !c.isMinimized } : c
    ));
  };

  const markConversationAsRead = async (conversationId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // Update local state immediately
        setConversations(prev => prev.map(c => 
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ));
        // Trigger refresh of unread count in MessagesBell
        window.dispatchEvent(new Event('conversationRead'));
      }
    } catch (err) {
      console.error('Failed to mark conversation as read:', err);
    }
  };

  const markAllMessagesAsRead = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // 1. Call API to update database
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // 2. Update local conversations state (remove unread badges inside the list)
        setConversations(prev => prev.map(c => ({ ...c, unreadCount: 0 })));
        
        // 3. Tell the Bell component to reset to 0
        window.dispatchEvent(new Event('messagesMarkedRead'));
        
        // Set flag to prevent fetches from overriding our local state
        justMarkedAllReadRef.current = true;
        setTimeout(() => {
          justMarkedAllReadRef.current = false;
        }, 10000);
      }
    } catch (err) {
      console.error('Failed to mark all messages as read:', err);
    }
  };

  const getOtherParticipant = (conv: Conversation) => {
    // Get userId from token directly to avoid stale state
    let userId = currentUserId;
    if (!userId) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.sub;
        } catch {
          // fallback
        }
      }
    }
    return conv.participant1.id === userId ? conv.participant2 : conv.participant1;
  };

  const handleConversationClick = (conv: Conversation) => {
    openChat(conv);
    setShowConversations(false);
  };

  // Check token directly as well - isLoggedIn state might be stale
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');
  
  if (!authChecked || (!isLoggedIn && !hasToken)) {
    return null;
  }

  return (
    <>
      {/* Conversations Dropdown - positioned at top right of page */}
      {showConversations && (
        <div 
          ref={conversationsRef}
          className="fixed top-16 left-2 right-2 sm:left-8 sm:right-auto sm:w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden"
          dir="rtl"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">הודעות</h3>
            <div className="flex items-center gap-1">
              {conversations.some(c => (c.unreadCount || 0) > 0) && (
                <button
                  onClick={markAllMessagesAsRead}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
                  title="סמן הכל כנקרא"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
              <button 
                onClick={() => setShowConversations(false)}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {loadingConversations ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path 
                    d="M22 17C22 17.5304 21.7893 18.0391 21.4142 18.4142C21.0391 18.7893 20.5304 19 20 19H6.828C6.29761 19.0001 5.78899 19.2109 5.414 19.586L3.212 21.788C3.1127 21.8873 2.9862 21.9549 2.84849 21.9823C2.71077 22.0097 2.56803 21.9956 2.43831 21.9419C2.30858 21.8881 2.1977 21.7971 2.11969 21.6804C2.04167 21.5637 2.00002 21.4264 2 21.286V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H20C20.5304 3 21.0391 3.21071 21.4142 3.58579C21.7893 3.96086 22 4.46957 22 5V17Z" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-sm">אין הודעות עדיין</p>
              </div>
            ) : (
              conversations.map(conv => {
                const other = getOtherParticipant(conv);
                return (
                  <div
                    key={conv.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition cursor-pointer text-right ${
                      (conv.unreadCount || 0) > 0 ? 'bg-[#FCFCFC]' : ''
                    }`}
                  >
                    <a
                      href={`/profile/${other.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="relative flex-shrink-0 hover:opacity-80 transition"
                    >
                      {other.profileImage ? (
                        <Image
                          src={getImageUrl(other.profileImage)}
                          alt={other.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                          {other.name?.charAt(0) || '?'}
                        </div>
                      )}
                    </a>
                    <button
                      onClick={() => handleConversationClick(conv)}
                      className="flex-1 min-w-0 text-right"
                    >
                      <p className={`text-sm ${(conv.unreadCount || 0) > 0 ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {other.name}
                      </p>
                      {conv.lastMessageText && (
                        <p className="text-xs text-gray-500 truncate">
                          {conv.lastMessageText}
                        </p>
                      )}
                    </button>
                    {(conv.unreadCount || 0) > 0 && (
                      <>
                        <span className="bg-[#A7EA7B] text-black text-xs font-semibold rounded-full min-w-[24px] h-6 flex items-center justify-center px-2">
                          {conv.unreadCount}
                        </span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markConversationAsRead(conv.id);
                          }}
                          className="p-1 text-gray-400 hover:text-[#65A30D] hover:bg-[#A7EA7B]/20 rounded-full transition"
                          title="סמן כנקרא"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Chat windows at bottom */}
      <div className="fixed bottom-0 right-2 sm:right-24 flex flex-row-reverse items-end gap-2 z-40">
      {openChats.map((chat) => (
        chat.isMinimized ? (
          <div
            key={chat.conversationId}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-t-lg shadow-lg"
          >
            <button
              onClick={() => toggleMinimize(chat.conversationId)}
              className="flex items-center gap-1.5 hover:opacity-70 transition"
              title={chat.recipientName}
            >
              {chat.recipientImage ? (
                <Image
                  src={getImageUrl(chat.recipientImage)}
                  alt={chat.recipientName}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 bg-[#E1E1E2] rounded-full flex items-center justify-center text-gray-700 text-xs font-bold">
                  {chat.recipientName.charAt(0)}
                </div>
              )}
              <span className="text-sm font-medium text-gray-700">{chat.recipientName}</span>
            </button>
            <button
              onClick={() => closeChat(chat.conversationId)}
              className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition"
              title="סגור"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ) : (
          <ChatWindow
            key={chat.conversationId}
            chat={chat}
            currentUserId={currentUserId}
            onClose={() => closeChat(chat.conversationId)}
            onMinimize={() => toggleMinimize(chat.conversationId)}
            onNewMessage={(msg) => {
              setOpenChats(prev => prev.map(c => 
                c.conversationId === chat.conversationId 
                  ? { ...c, messages: [...c.messages, msg] }
                  : c
              ));
            }}
          />
        )
      ))}
    </div>
    </>
  );
}

// Individual Chat Window Component
function ChatWindow({ 
  chat, 
  currentUserId, 
  onClose, 
  onMinimize,
  onNewMessage 
}: { 
  chat: OpenChat; 
  currentUserId: string | null;
  onClose: () => void;
  onMinimize: () => void;
  onNewMessage: (msg: Message) => void;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    setSending(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientId: chat.recipientId,
          content: message.trim(),
        }),
      });

      if (res.ok) {
        const newMsg = await res.json();
        onNewMessage(newMsg);
        setMessage('');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-[calc(100vw-1rem)] sm:w-80 max-h-[350px] bg-white rounded-t-xl shadow-2xl border border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-2">
          <a
            href={`/profile/${chat.recipientId}`}
            className="hover:opacity-80 transition"
          >
            {chat.recipientImage ? (
              <Image
                src={getImageUrl(chat.recipientImage)}
                alt={chat.recipientName}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 bg-[#E1E1E2] rounded-full flex items-center justify-center text-gray-700 font-bold text-sm">
                {chat.recipientName.charAt(0)}
              </div>
            )}
          </a>
          <span className="font-medium text-gray-900">{chat.recipientName}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onMinimize} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div dir="ltr" className="flex-1 max-h-[250px] overflow-y-auto p-3 bg-[#F4F4F5]">
        <div dir="rtl" className="space-y-3">
        {chat.isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#A7EA7B]"></div>
          </div>
        ) : chat.messages.length === 0 ? (
          <div className="text-center text-[#A1A1AA] text-sm py-8">
            התחל שיחה חדשה
          </div>
        ) : (
          chat.messages.map((msg, index) => {
            // Get userId from token directly to avoid stale state
            let userId = currentUserId;
            if (!userId) {
              const token = localStorage.getItem('token');
              if (token) {
                try {
                  const payload = JSON.parse(atob(token.split('.')[1]));
                  userId = payload.sub;
                } catch {
                  // fallback
                }
              }
            }
            const isOwn = msg.senderId === userId;
            
            // Check if this message is part of a consecutive group from same sender
            const prevMsg = chat.messages[index - 1];
            const nextMsg = chat.messages[index + 1];
            const isSameSenderAsPrev = prevMsg && prevMsg.senderId === msg.senderId;
            const isSameSenderAsNext = nextMsg && nextMsg.senderId === msg.senderId;
            const isLastInGroup = !isSameSenderAsNext;
            
            // Tighter bottom spacing if next message is from same sender
            const marginClass = isSameSenderAsNext ? 'mb-1' : 'mb-3';
            // Tighter top spacing if prev message is from same sender
            const marginTopClass = isSameSenderAsPrev ? 'mt-0' : '';
            
            return (
              <div key={msg.id} className={`flex ${marginClass} ${marginTopClass} ${isOwn ? 'justify-start' : 'justify-end'}`}>
                <div 
                  className="relative max-w-[75%]"
                  style={{
                    backgroundColor: isOwn ? '#A7EA7B' : '#FFFFFF',
                    padding: '6px 10px 8px 12px',
                    borderRadius: isOwn 
                      ? (isSameSenderAsPrev ? '12px' : '12px 0px 12px 12px')
                      : (isSameSenderAsPrev ? '12px' : '0px 12px 12px 12px'),
                    boxShadow: isOwn ? '0 1px 0.5px rgba(11,20,26,.13)' : 'none',
                    minWidth: '60px',
                  }}
                >
                  {/* SVG Tail for own messages - right side */}
                  {isOwn && !isSameSenderAsPrev && (
                    <svg
                      width="12"
                      height="19"
                      viewBox="0 0 12 19"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: -11.5,
                        pointerEvents: 'none'
                      }}
                    >
                      <path
                        d="M10.865 0C11.713 0.000213899 12.176 0.989368 11.633 1.64062L1.854 13.3745C0.656 14.8122 0 16.6245 0 18.4961V0H10.865Z"
                        fill="#A7EA7B"
                      />
                    </svg>
                  )}
                  {/* SVG Tail for other messages - left side */}
                  {!isOwn && !isSameSenderAsPrev && (
                    <svg
                      width="12"
                      height="19"
                      viewBox="0 0 12 19"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: -8,
                        pointerEvents: 'none'
                      }}
                    >
                      <path
                        d="M1.135 0C0.287 0.000213899 -0.176 0.989368 0.367 1.64062L10.146 13.3745C11.344 14.8122 12 16.6245 12 18.4961V0H1.135Z"
                        fill="#FFFFFF"
                      />
                    </svg>
                  )}
                  {/* Content with text and timestamp below */}
                  <div>
                    <p
                      style={{
                        fontSize: '15px',
                        lineHeight: '20px',
                        color: '#000000',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        margin: 0,
                      }}
                    >
                      {msg.content}
                    </p>
                    {isLastInGroup && (
                      <p
                        style={{
                          fontSize: '11px',
                          color: 'rgba(0, 0, 0, 0.45)',
                          lineHeight: '15px',
                          margin: '4px 0 0 0',
                          textAlign: 'right',
                        }}
                      >
                        {formatTime(msg.createdAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex-shrink-0 border-t border-gray-200 p-2 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="הקלד הודעה..."
          className="flex-1 border border-[#999999] rounded-[10px] px-3 py-1.5 text-sm focus:outline-none focus:border-[#A7EA7B]"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!message.trim() || sending}
          className="w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {sending ? (
            <div className="w-8 h-8 bg-[#A7EA7B] rounded-full flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
              <rect width="32" height="32" rx="16" fill="#A7EA7B" />
              <path d="M21.5238 21.9663C21.5838 21.9956 21.6512 22.0061 21.7172 21.9966C21.7832 21.987 21.8448 21.9577 21.894 21.9126C21.9431 21.8674 21.9776 21.8086 21.9927 21.7436C22.0079 21.6786 22.0032 21.6106 21.9792 21.5483L20.0838 16.4637C19.972 16.1635 19.972 15.8332 20.0838 15.533L21.9785 10.4483C22.0024 10.3862 22.0071 10.3183 21.9919 10.2534C21.9767 10.1886 21.9424 10.1298 21.8933 10.0847C21.8443 10.0396 21.7828 10.0103 21.7169 10.0006C21.651 9.99094 21.5838 10.0013 21.5238 10.0303L9.52382 15.697C9.46674 15.724 9.4185 15.7667 9.38472 15.82C9.35093 15.8734 9.333 15.9352 9.333 15.9983C9.333 16.0615 9.35093 16.1233 9.38472 16.1767C9.4185 16.23 9.46674 16.2727 9.52382 16.2997L21.5238 21.9663Z" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 16L9.33333 16" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}

// Messages Bell Component - for chat messages icon in navbar
export function MessagesBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const justMarkedReadRef = useRef(false);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      // Skip fetch if we just marked all as read (give server time to process)
      if (justMarkedReadRef.current) return;
      
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        console.error('Failed to fetch unread message count:', err);
      }
    };

    // Listen for mark all as read event
    const handleMarkedRead = () => {
      setUnreadCount(0);
      justMarkedReadRef.current = true;
      // Reset after 10 seconds to allow normal polling again
      setTimeout(() => {
        justMarkedReadRef.current = false;
      }, 10000);
    };

    // Listen for single conversation read event - immediately refetch
    const handleConversationRead = () => {
      fetchUnreadCount();
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    window.addEventListener('messagesMarkedRead', handleMarkedRead);
    window.addEventListener('conversationRead', handleConversationRead);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('messagesMarkedRead', handleMarkedRead);
      window.removeEventListener('conversationRead', handleConversationRead);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof (window as any).toggleChatWidget === 'function') {
      (window as any).toggleChatWidget();
    } else {
      (window as any).chatWidgetOpenIntent = true;
    }
  };

  return (
    <button
      onClick={handleClick}
      data-messages-bell
      className="relative p-2 -mt-1 text-gray-500 hover:text-gray-700 transition flex items-center justify-center"
      aria-label="הודעות"
    >
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
          d="M22 17C22 17.5304 21.7893 18.0391 21.4142 18.4142C21.0391 18.7893 20.5304 19 20 19H6.828C6.29761 19.0001 5.78899 19.2109 5.414 19.586L3.212 21.788C3.1127 21.8873 2.9862 21.9549 2.84849 21.9823C2.71077 22.0097 2.56803 21.9956 2.43831 21.9419C2.30858 21.8881 2.1977 21.7971 2.11969 21.6804C2.04167 21.5637 2.00002 21.4264 2 21.286V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H20C20.5304 3 21.0391 3.21071 21.4142 3.58579C21.7893 3.96086 22 4.46957 22 5V17Z" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-[#A7EA7B] text-black text-[11px] font-semibold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
