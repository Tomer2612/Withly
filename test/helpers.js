// Shared test helpers. Tests run against the COMPILED backend in dist/
// (`npm test` builds first) with a fake Prisma, so they need no database.
const path = require('path');

const dist = (...p) => require(path.join(__dirname, '..', 'dist', ...p));

// HttpException → "403 NOT_A_COMMUNITY_MEMBER"; success → "OK".
async function outcome(fn) {
  try {
    await fn();
    return 'OK';
  } catch (e) {
    return `${typeof e.getStatus === 'function' ? e.getStatus() : 'ERR'} ${e.message}`;
  }
}

// A fake Prisma client: `handlers` maps "model.method" to a function of the
// query args. Unlisted reads return empty results; unlisted writes return {}.
function fakePrisma(handlers = {}) {
  const defaults = { findUnique: null, findFirst: null, findMany: [], count: 0, groupBy: [], create: {}, update: {}, upsert: {}, delete: {}, deleteMany: {} };
  const prisma = new Proxy({}, {
    get: (_, model) => {
      if (model === '$transaction') return async (arg) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg));
      return new Proxy({}, {
        get: (_m, method) => async (args = {}) => {
          const h = handlers[`${String(model)}.${String(method)}`];
          if (h) return h(args);
          if (method in defaults) return defaults[method];
          throw new Error(`fake prisma: no handler for ${String(model)}.${String(method)}`);
        },
      });
    },
  });
  return prisma;
}

// One community "c1" owned by u_owner, with a manager and a member. Anyone
// else (u_outsider) is a logged-in non-member — same position as a removed
// or banned member.
const USERS = { owner: 'u_owner', manager: 'u_manager', member: 'u_member', outsider: 'u_outsider' };

function communityHandlers(extra = {}) {
  return {
    'community.findUnique': ({ where }) =>
      where.id === 'c1' || where.slug === 'c1'
        ? { id: 'c1', ownerId: USERS.owner, subscriptionStatus: 'ACTIVE', status: 'PUBLIC', createdAt: new Date(), owner: null, _count: { members: 2 } }
        : null,
    'communityMember.findUnique': ({ where }) =>
      ({ [USERS.manager]: { role: 'MANAGER' }, [USERS.member]: { role: 'USER' } })[where.userId_communityId.userId] ?? null,
    ...extra,
  };
}

module.exports = { dist, outcome, fakePrisma, USERS, communityHandlers };
