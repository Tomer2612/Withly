// Payment order ownership, direct-message recipients, link-preview SSRF
// protection, quiz answer key, request validation, and auth cookie settings.
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');
const { dist, outcome, fakePrisma, USERS, communityHandlers } = require('./helpers');

const { PaymentsController } = dist('payments', 'payments.controller.js');
const { MessagesService } = dist('messages', 'messages.service.js');
const { isPublicAddress, fetchPublicHtml } = dist('common', 'safe-fetch.js');
const { CommunitiesService } = dist('communities', 'communities.service.js');
const { CoursesService } = dist('courses', 'courses.service.js');
const dto = dist('communities', 'dto', 'communities.dto.js');

test('create-payment only signs orders for the caller\'s own account', async () => {
  const hyp = { signPayment: async () => 'https://pay.example/signed' };
  const ctrl = new PaymentsController(hyp, {}, {}, {}, {});
  const req = { user: { userId: 'me' } };
  const body = (order) => ({ amount: 1, clientName: 'x', email: 'x@x.x', order });
  for (const order of ['tokenize-cardOnFile-me-1', 'tokenize-community-c1-me-1', 'tokenize-newCommunity-p1-me-1', 'tokenize-memberJoin-c1-me-1']) {
    assert.equal(await outcome(() => ctrl.createPayment(req, body(order))), 'OK', order);
  }
  for (const order of ['tokenize-cardOnFile-victim-1', 'tokenize-community-c1-victim-1', 'tokenize-memberJoin-c1-victim-1', 'tokenize-dunning-abc', 'anything-else', '']) {
    assert.equal(await outcome(() => ctrl.createPayment(req, body(order))), '400 INVALID_PAYMENT_ORDER', order);
  }
});

test('direct messages need a real, other recipient and valid content', async () => {
  const svc = new MessagesService(fakePrisma({
    'user.findUnique': ({ where }) => (where.id === 'friend' ? { id: 'friend' } : null),
    'conversation.findUnique': () => ({ id: 'conv1' }),
    'message.create': () => ({ id: 'm1', createdAt: new Date() }),
  }));
  assert.equal(await outcome(() => svc.sendMessage('me', 'friend', 'hi')), 'OK');
  assert.equal(await outcome(() => svc.sendMessage('me', 'me', 'hi')), '400 INVALID_RECIPIENT');
  assert.match(await outcome(() => svc.sendMessage('me', 'ghost', 'hi')), /^404 /);
  assert.equal(await outcome(() => svc.sendMessage('me', 'friend', '   ')), '400 INVALID_MESSAGE');
  assert.equal(await outcome(() => svc.sendMessage('me', 'friend', 'x'.repeat(5001))), '400 INVALID_MESSAGE');
  assert.equal(await outcome(() => svc.startConversation('me', 'me')), '400 INVALID_RECIPIENT');
});

test('link preview never reaches internal addresses', async () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPublicAddress(ip), true, ip);
  for (const url of ['http://127.0.0.1/', 'http://localhost/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://169.254.169.254/latest/meta-data/', 'http://2130706433/', 'file:///etc/passwd', 'http://example.com:22/', 'not a url']) {
    assert.equal(await fetchPublicHtml(url, { timeoutMs: 2000 }), null, url);
  }
});

test('quiz: learners get no answer key; the server checks answers', async () => {
  const course = {
    id: 'course1', communityId: 'c1', authorId: USERS.owner, community: { id: 'c1' }, _count: { enrollments: 0 },
    chapters: [{ lessons: [{ id: 'L1', duration: 1, quiz: { questions: [{ id: 'q1', options: [{ id: 'a', text: 'A', isCorrect: true, order: 0, questionId: 'q1' }, { id: 'b', text: 'B', isCorrect: false, order: 1, questionId: 'q1' }] }] } }] }],
  };
  const prisma = fakePrisma(communityHandlers({
    'course.findUnique': () => course,
    'lessonQuizQuestion.findFirst': () => ({ id: 'q1', options: [{ id: 'a', isCorrect: true }, { id: 'b', isCorrect: false }], quiz: { lesson: { chapter: { course: { communityId: 'c1' } } } } }),
  }));
  const courses = new CoursesService(prisma, new CommunitiesService(prisma, {}, {}, {}, {}));
  const keyOf = (c) => c.chapters[0].lessons[0].quiz.questions[0].options.map((o) => o.isCorrect);
  assert.deepEqual(keyOf(await courses.getCourseById('course1', USERS.member)), [undefined, undefined], 'member: no key');
  assert.deepEqual(keyOf(await courses.getCourseById('course1', USERS.manager)), [true, false], 'manager (editor): key');
  assert.deepEqual(await courses.checkQuizAnswer('L1', 'q1', ['a'], USERS.member), { correct: true, correctOptionIds: ['a'] });
  assert.deepEqual(await courses.checkQuizAnswer('L1', 'q1', ['b'], USERS.member), { correct: false, correctOptionIds: [] });
  assert.equal(await outcome(() => courses.checkQuizAnswer('L1', 'q1', ['zzz'], USERS.member)), '400 INVALID_QUIZ_OPTION');
  assert.equal(await outcome(() => courses.checkQuizAnswer('L1', 'q1', ['a'], USERS.outsider)), '403 NOT_A_COMMUNITY_MEMBER');
});

test('community link validation (DTO, same options as the global ValidationPipe)', async () => {
  const bad = async (payload) => (await validate(plainToInstance(dto.UpdateCommunityDto, payload), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property).sort();
  assert.deepEqual(await bad({ linkedinUrl: 'https://www.linkedin.com/in/x', customLinkUrl: 'https://site.co.il', customLinkLabel: 'לאתר' }), []);
  assert.deepEqual(await bad({ youtubeUrl: '', linkedinUrl: '', customLinkUrl: '' }), []);
  assert.deepEqual(await bad({ facebookUrl: 'https://facebook.com.evil.io/', youtubeUrl: 'javascript:alert(1)', customLinkUrl: 'site.co.il' }), ['customLinkUrl', 'facebookUrl', 'youtubeUrl']);
  assert.deepEqual(await bad({ customLinkLabel: 'א'.repeat(21) }), ['customLinkLabel']);
});

// .env must be loaded before any module reads process.env at load time.
// Regression: after Prisma 7 (which no longer loads .env on import) the
// refresh cookie fell back to path=/auth on prod and users were signed out
// every 15 minutes.
test('auth cookie settings come from .env (loaded first thing in main.js)', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { execFileSync } = require('child_process');
  const distDir = path.join(__dirname, '..', 'dist');

  const main = fs.readFileSync(path.join(distDir, 'main.js'), 'utf8');
  assert.equal(main.match(/require\("([^"]+)"\)/)[1], 'dotenv/config');

  // Load .env the way main.js does, from a throwaway directory whose .env
  // holds prod-like cookie settings, then see what the refresh cookie gets.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'withly-env-'));
  fs.writeFileSync(path.join(dir, '.env'), 'REFRESH_COOKIE_PATH=/api/auth\nNODE_ENV=production\n');
  const script = `
    require(${JSON.stringify(require.resolve('dotenv/config'))});
    const { setRefreshCookie } = require(${JSON.stringify(path.join(distDir, 'auth', 'cookies.helper.js'))});
    const set = {};
    setRefreshCookie({ cookie: (name, _v, opts) => { set[name] = opts; } }, 'token');
    process.stdout.write(JSON.stringify(set.refresh_token));`;
  const env = { ...process.env, DOTENV_CONFIG_QUIET: 'true' };
  delete env.REFRESH_COOKIE_PATH;
  delete env.NODE_ENV;
  const opts = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: dir, env, encoding: 'utf8' }));
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(opts.path, '/api/auth');
  assert.equal(opts.secure, true);
});
