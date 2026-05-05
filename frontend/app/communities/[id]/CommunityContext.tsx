'use client';

import { createContext, useContext } from 'react';

interface Community {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  ownerId: string;
  subscriptionStatus: 'ACTIVE' | 'SUSPENDED';
  price?: number | null;
  pendingPrice?: number | null;
  pendingPriceEffectiveAt?: string | null;
  priceChangeAnnouncedAt?: string | null;
}

interface UserProfile {
  name?: string;
  profileImage?: string | null;
}

export interface CommunityLayoutContextType {
  community: Community | null;
  userEmail: string | null;
  userId: string | null;
  userProfile: UserProfile | null;
  userRole: 'OWNER' | 'MANAGER' | 'MEMBER' | null;
  isOwner: boolean;
  isManager: boolean;
  isOwnerOrManager: boolean;
  isMember: boolean | null;
  loading: boolean;
  refreshCommunity: () => Promise<void>;
  // Search state managed by layout
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const CommunityLayoutContext = createContext<CommunityLayoutContextType | null>(null);

export function useCommunityContext() {
  const context = useContext(CommunityLayoutContext);
  if (!context) {
    throw new Error('useCommunityContext must be used within a CommunityLayoutProvider');
  }
  return context;
}
