// One-off (owner request, 2026-11-14): in these communities the member list
// and the leaderboard are visible to the owner and managers only — regular
// members get 403. Deliberately a constant, not a Community column: to add or
// remove a community, edit this list and deploy.
//
// This file is the enforcement. frontend/app/lib/memberListVisibility.ts
// mirrors the list only to hide the tabs/widgets in the UI.
export const MANAGERS_ONLY_MEMBER_LIST_COMMUNITY_IDS: ReadonlySet<string> = new Set([
  'cmweppisw0019qakssddfj6wm', // ai-forstudents
]);
