// ─────────────────────────────────────────────────────────────
// Headless, DETERMINISTIC Documenso API-token seed for the gafood bridge.
//
// Documenso v2 made ApiToken.teamId REQUIRED — a token must belong to a Team,
// which belongs to an Organisation (a long mandatory FK chain). Hand-seeding
// that chain in raw SQL is brittle, so instead we run INSIDE the documenso-app
// container and reuse Documenso's OWN code (createUser → createPersonalOrganisation)
// to build the user + personal org + team. We then insert the ApiToken row
// ourselves with token = sha512hex(DOCUMENSO_API_TOKEN) — the exact value
// Documenso computes (createHash('sha512').digest('hex'), no salt) and looks up
// on every Bearer call. The SAME raw token is the backend's DOCUMENSO_API_TOKEN,
// so the two sides match WITHOUT minting a random token (no redeploy loop).
//
// Idempotent: reuses the user if present, upserts the token by its hash.
// Run from /app inside the official documenso/documenso image (see seed-token.sh).
// ─────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';

// Documenso's compiled server bundle lives here in the official image. These are
// plain ESM modules with self-contained relative imports.
const B = './apps/remix/build/server/hono/packages';
const { prisma } = await import(`${B}/prisma/index.js`);
const { createUser } = await import(`${B}/lib/server-only/user/create-user.js`);
const { createPersonalOrganisation } = await import(
  `${B}/lib/server-only/organisation/create-organisation.js`
);

const RAW = process.env.DOCUMENSO_API_TOKEN;
const EMAIL = (process.env.BRIDGE_EMAIL || 'backend-service@internal').toLowerCase();
const TOKEN_NAME = process.env.BRIDGE_TOKEN_NAME || 'gafood-backend';

if (!RAW) {
  console.error('ERROR: DOCUMENSO_API_TOKEN must be set (form: api_<random>).');
  process.exit(1);
}

// Documenso's hashString: SHA-512, hex, no salt.
const hashed = createHash('sha512').update(RAW).digest('hex');

async function main() {
  let user = await prisma.user.findFirst({ where: { email: EMAIL } });
  if (!user) {
    // createUser → onCreateUserHook → createPersonalOrganisation (org + team).
    user = await createUser({
      name: 'Backend Service',
      email: EMAIL,
      // Login is never used (no public UI); a random password is fine.
      password: process.env.BRIDGE_PASSWORD || `P${Math.random().toString(36).slice(2)}!9`,
    });
    console.error(`Created service user ${EMAIL} (id ${user.id}).`);
  } else {
    console.error(`Reusing service user ${EMAIL} (id ${user.id}).`);
  }

  // Find the user's personal org → team. If org creation silently failed during
  // createUser (its hook swallows errors), repair it here, throwing on failure.
  let member = await prisma.organisationMember.findFirst({
    where: { userId: user.id },
    select: { organisationId: true },
  });
  if (!member) {
    await createPersonalOrganisation({
      userId: user.id,
      throwErrorOnOrganisationCreationFailure: true,
    });
    member = await prisma.organisationMember.findFirst({
      where: { userId: user.id },
      select: { organisationId: true },
    });
  }
  if (!member) throw new Error('No organisation membership for the service user.');

  const team = await prisma.team.findFirst({
    where: { organisationId: member.organisationId },
    select: { id: true },
  });
  if (!team) throw new Error('No team found in the service user organisation.');

  await prisma.apiToken.upsert({
    where: { token: hashed },
    update: {},
    create: { name: TOKEN_NAME, token: hashed, userId: user.id, teamId: team.id },
  });

  console.error(`Documenso API token provisioned (teamId ${team.id}, userId ${user.id}).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
