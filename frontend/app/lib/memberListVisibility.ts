// One-off: communities whose member list + leaderboard are shown to the owner
// and managers only. UI-only mirror of src/common/member-list-visibility.ts —
// the backend enforces it (403); this just hides the tabs/widgets so regular
// members don't land on empty pages. Keep the two lists in sync.
const MANAGERS_ONLY_MEMBER_LIST_COMMUNITY_IDS: ReadonlySet<string> = new Set([
  'cmweppisw0019qakssddfj6wm', // ai-forstudents
]);

// True when this viewer must NOT see the member list / leaderboard.
export function isMemberListHiddenFor(
  communityId: string | null | undefined,
  isOwnerOrManager: boolean,
): boolean {
  return !!communityId && MANAGERS_ONLY_MEMBER_LIST_COMMUNITY_IDS.has(communityId) && !isOwnerOrManager;
}
