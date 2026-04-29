import type { PrismaService } from './prisma.service';

export type EffectiveRole = 'OWNER' | 'MANAGER' | 'USER';

// After D2, an owner has no community_members row — ownership lives only on
// Community.ownerId. This helper folds both sources back into a single role
// answer so callers don't need to know which table to look at.
export async function getEffectiveRole(
  prisma: PrismaService,
  communityId: string,
  userId: string,
): Promise<EffectiveRole | null> {
  const [community, membership] = await Promise.all([
    prisma.community.findUnique({
      where: { id: communityId },
      select: { ownerId: true },
    }),
    prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
      select: { role: true },
    }),
  ]);
  if (!community) return null;
  if (community.ownerId === userId) return 'OWNER';
  return membership?.role ?? null;
}

export function canManageCommunity(role: EffectiveRole | null): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}
