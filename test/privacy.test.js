// Personal data: other users' emails are never returned, the owner's card is
// owner-only, and member lists / leaderboard are members-only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dist, outcome, fakePrisma, USERS, communityHandlers } = require('./helpers');

const { CommunitiesService } = dist('communities', 'communities.service.js');
const { UsersService } = dist('users', 'users.service.js');
const { PostsService } = dist('posts', 'posts.service.js');
const { EventsService } = dist('events', 'events.service.js');
// The one managers-only community (MANAGERS_ONLY_MEMBER_LIST_COMMUNITY_IDS in
// communities.service.ts).
const MANAGERS_ONLY_COMMUNITY_ID = 'cmweppisw0019qakssddfj6wm';

test('public community payload: no card (for anyone) and no owner email', async () => {
  let include = null;
  const prisma = fakePrisma({
    'community.findUnique': (args) => {
      include = args.include;
      return { id: 'c1', ownerId: USERS.owner, status: 'PUBLIC', owner: { id: USERS.owner, name: 'O', profileImage: null }, _count: { members: 2 } };
    },
  });
  const svc = new CommunitiesService(prisma, {}, {}, {}, {});
  for (const viewer of [USERS.owner, USERS.member, undefined]) {
    const res = await svc.findById('c1', viewer);
    assert.equal('paymentMethod' in res, false);
  }
  assert.equal(include.paymentMethod, undefined);
  assert.equal(include.owner.select.email, undefined);
});

test('owner card endpoint: owner only, last 4 + brand only', async () => {
  const prisma = fakePrisma({
    'community.findUnique': ({ where, select }) => (where.id === 'c1' || where.slug === 'c1'
      ? { id: 'c1', ownerId: USERS.owner, ...(select?.paymentMethod ? { paymentMethod: { cardLastFour: '4399', cardBrand: 'visa' } } : {}) }
      : null),
  });
  const svc = new CommunitiesService(prisma, {}, {}, {}, {});
  const own = await svc.getOwnerPaymentMethod('c1', USERS.owner);
  assert.deepEqual(own, { paymentMethod: { cardLastFour: '4399', cardBrand: 'visa' } });
  assert.match(await outcome(() => svc.getOwnerPaymentMethod('c1', USERS.manager)), /^403 /);
  assert.match(await outcome(() => svc.getOwnerPaymentMethod('nope', USERS.owner)), /^404 /);
});

test('public profile, comments and event attendees never select email', async () => {
  let profileSelect, commentInclude, attendeeSelect;
  await new UsersService(fakePrisma({ 'user.findUnique': ({ select }) => { profileSelect = select; return {}; } }), {}, {}, {}).getPublicProfile('u1');
  assert.equal(profileSelect.email, undefined);

  const prisma = fakePrisma(communityHandlers({
    'post.findUnique': () => ({ communityId: 'c1' }),
    'comment.findMany': ({ include }) => { commentInclude = include; return []; },
    'event.findUnique': () => ({ id: 'e1', communityId: 'c1', attendeeType: 'all' }),
    'eventRsvp.findMany': () => [{ userId: 'u1' }],
    'user.findMany': ({ select }) => { attendeeSelect = select; return []; },
  }));
  const communities = new CommunitiesService(prisma, {}, {}, {}, {});
  await new PostsService(prisma, communities).getComments('p1', USERS.owner);
  await new EventsService(prisma, communities).getAttendees('e1', USERS.owner);
  assert.equal(commentInclude.user.select.email, undefined);
  assert.equal(attendeeSelect.email, undefined);
});

test('member list + leaderboard: members only; managers-only communities: owner + managers', async () => {
  const hiddenId = MANAGERS_ONLY_COMMUNITY_ID;
  for (const cid of ['c1', hiddenId]) {
    let userSelect = null;
    const prisma = fakePrisma({
      'community.findUnique': ({ where }) => (where.id === cid || where.slug === cid
        ? { id: cid, ownerId: USERS.owner, createdAt: new Date(), owner: { id: USERS.owner, name: 'O', profileImage: null, createdAt: new Date(), lastActiveAt: null, showOnline: true } }
        : null),
      'communityMember.findUnique': ({ where }) =>
        ({ [USERS.manager]: { role: 'MANAGER' }, [USERS.member]: { role: 'USER' } })[where.userId_communityId.userId] ?? null,
      'user.findMany': ({ select }) => { userSelect = select; return [{ id: USERS.owner, name: 'O', email: 'leak@test', profileImage: null }]; },
    });
    const svc = new CommunitiesService(prisma, {}, {}, {}, {});
    const managersOnly = cid === hiddenId;
    const expect = { owner: 'OK', manager: 'OK', member: managersOnly ? '403' : 'OK', outsider: '403' };
    for (const role of Object.keys(USERS)) {
      for (const call of [() => svc.getCommunityMembers(cid, USERS[role]), () => svc.getTopMembers(cid, USERS[role], 3)]) {
        const got = await outcome(call);
        assert.equal(got.slice(0, expect[role].length), expect[role], `${cid} as ${role}: ${got}`);
      }
    }
    const top = await svc.getTopMembers(cid, USERS.owner, 3);
    assert.equal(top.some((r) => 'email' in r), false, 'leaderboard rows carry no email');
    assert.equal(userSelect.email, undefined, 'leaderboard query does not select email');
  }
});
