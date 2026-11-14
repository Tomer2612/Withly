// Community content (posts, comments, courses, lessons, events) is for the
// community's own people. Every read and every content-adding write, as each
// role. Guards against the 2026-11 finding: these used to be open to anyone.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dist, outcome, fakePrisma, USERS, communityHandlers } = require('./helpers');

const { CommunitiesService } = dist('communities', 'communities.service.js');
const { PostsService } = dist('posts', 'posts.service.js');
const { CoursesService } = dist('courses', 'courses.service.js');
const { EventsService } = dist('events', 'events.service.js');

function services(viewer, log = {}) {
  const course = { id: 'course1', communityId: 'c1', authorId: USERS.owner, title: 'T', chapters: [], community: { id: 'c1' }, _count: { enrollments: 0 } };
  const prisma = fakePrisma(communityHandlers({
    // The viewer is always the author of what they edit, so only membership can stop them.
    'post.findUnique': ({ where }) => ({ id: where.id, communityId: 'c1', authorId: viewer, poll: null, images: [], videos: [], files: [], links: [] }),
    'post.findMany': (args) => { log.postsQuery = args; return []; },
    'post.create': () => ({ id: 'new_post' }),
    'post.update': () => ({ id: 'p1' }),
    'comment.findUnique': ({ where }) => ({ id: where.id, userId: viewer, post: { communityId: 'c1' } }),
    'comment.create': () => ({ id: 'cm1', post: { authorId: USERS.owner, communityId: 'c1' } }),
    'poll.findUnique': () => ({ id: 'poll1', question: 'q', expiresAt: null, options: [{ id: 'opt1', text: 'a', _count: { votes: 0 }, votes: [] }], post: { communityId: 'c1' } }),
    'poll.create': () => ({ id: 'poll1', question: 'q', expiresAt: null, options: [] }),
    'course.findUnique': () => course,
    'lesson.findUnique': () => ({ id: 'lesson1', chapter: { courseId: 'course1', course: { id: 'course1', title: 'T', authorId: USERS.owner, communityId: 'c1' } } }),
    'event.findUnique': ({ where }) => ({ id: where.id, communityId: 'c1', capacity: null, rsvps: [], _count: { rsvps: 0 }, attendeeType: where.id === 'e_mgr' ? 'managers' : 'all' }),
    'event.findMany': (args) => { log.eventsWhere = args.where; return []; },
  }));
  const communities = new CommunitiesService(prisma, {}, {}, {}, {});
  return {
    posts: new PostsService(prisma, communities),
    courses: new CoursesService(prisma, communities),
    events: new EventsService(prisma, communities),
  };
}

const OK = 'OK';
const DENIED = '403 NOT_A_COMMUNITY_MEMBER';
const HIDDEN = '404 Event not found';
const membersOnly = { owner: OK, manager: OK, member: OK, outsider: DENIED };
const managersOnlyEvent = { owner: OK, manager: OK, member: HIDDEN, outsider: DENIED };

const cases = [
  ['read posts feed', (s, u) => s.posts.findByCommunity('c1', u), membersOnly],
  ['read post comments', (s, u) => s.posts.getComments('p1', u), membersOnly],
  ['read course list', (s, u) => s.courses.getCoursesByCommunity('c1', u), membersOnly],
  ['read course detail', (s, u) => s.courses.getCourseById('course1', u), membersOnly],
  ['read single lesson', (s, u) => s.courses.getLessonById('lesson1', u), membersOnly],
  ['read events list', (s, u) => s.events.findByCommunity('c1', u), membersOnly],
  ['read upcoming events', (s, u) => s.events.findUpcoming('c1', u), membersOnly],
  ['read events calendar', (s, u) => s.events.getEventsForMonth('c1', 2026, 11, u), membersOnly],
  ['read event', (s, u) => s.events.findOne('e_all', u), membersOnly],
  ['read managers-only event', (s, u) => s.events.findOne('e_mgr', u), managersOnlyEvent],
  ['read event attendees', (s, u) => s.events.getAttendees('e_all', u), membersOnly],
  ['upload gate for a new post', (s, u) => s.posts.assertCanPost('c1', u), membersOnly],
  ['create post', (s, u) => s.posts.create('hello', u, 'c1'), membersOnly],
  ['edit own post', (s, u) => s.posts.update('p1', 'edited', u), membersOnly],
  ['like', (s, u) => s.posts.toggleLike('p1', u), membersOnly],
  ['save', (s, u) => s.posts.toggleSave('p1', u), membersOnly],
  ['comment', (s, u) => s.posts.createComment('p1', u, 'hi'), membersOnly],
  ['edit own comment', (s, u) => s.posts.editComment('cm1', u, 'edited'), membersOnly],
  ['add poll to own post', (s, u) => s.posts.createPoll('p1', u, 'q', ['a', 'b']), membersOnly],
  ['vote in poll', (s, u) => s.posts.votePoll('poll1', 'opt1', u), membersOnly],
  ['enroll in course', (s, u) => s.courses.enrollInCourse('course1', u), membersOnly],
  ['complete lesson', (s, u) => s.courses.completeLesson('lesson1', u), membersOnly],
  ['RSVP', (s, u) => s.events.rsvp('e_all', u, 'GOING'), membersOnly],
  ['RSVP to managers-only event', (s, u) => s.events.rsvp('e_mgr', u, 'GOING'), managersOnlyEvent],
];

for (const [label, call, expected] of cases) {
  test(`content access: ${label}`, async () => {
    for (const role of Object.keys(USERS)) {
      assert.equal(await outcome(() => call(services(USERS[role]), USERS[role])), expected[role], `${label} as ${role}`);
    }
  });
}

test('managers-only events are filtered out of every list for regular members only', async () => {
  for (const [name, call] of [
    ['list', (s, u) => s.events.findByCommunity('c1', u)],
    ['upcoming', (s, u) => s.events.findUpcoming('c1', u)],
    ['calendar', (s, u) => s.events.getEventsForMonth('c1', 2026, 11, u)],
  ]) {
    for (const [role, hidden] of [['owner', false], ['manager', false], ['member', true]]) {
      const log = {};
      await call(services(USERS[role], log), USERS[role]);
      assert.equal(log.eventsWhere.attendeeType === 'all', hidden, `${name} as ${role}`);
    }
  }
});

test('the feed reads likes / saves / poll votes for the authenticated viewer only', async () => {
  const log = {};
  await services(USERS.member, log).posts.findByCommunity('c1', USERS.member);
  const inc = log.postsQuery.include;
  assert.equal(inc.likes.where.userId, USERS.member);
  assert.equal(inc.savedBy.where.userId, USERS.member);
  assert.equal(inc.poll.include.options.include.votes.where.userId, USERS.member);
});

test('lesson media upload: only owners/managers of some community', async () => {
  const make = (owned, managed) => new CoursesService(fakePrisma({
    'community.count': () => owned,
    'communityMember.count': () => managed,
  }), {});
  assert.equal(await outcome(() => make(1, 0).assertCanUploadLessonMedia('u')), 'OK');
  assert.equal(await outcome(() => make(0, 2).assertCanUploadLessonMedia('u')), 'OK');
  assert.match(await outcome(() => make(0, 0).assertCanUploadLessonMedia('u')), /^403 /);
});
