import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** A registered user plus the credentials/token the tests act with. */
export interface TestUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
}

// Monotonic suffix so emails are unique even within the same millisecond.
let seq = -1;

export function randomEmail(baseName: string = 'tester'): string {
  seq = (seq + 1) % 1000; // Giới hạn chuỗi số từ 000 đến 999
  const num = String(seq).padStart(3, '0');

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0'); // Tháng trong JS bắt đầu từ 0
  const yy = String(now.getFullYear()).slice(-2);

  return `${baseName}_${dd}${mm}${yy}_${num}@test.local`;
}

const DEFAULT_PASSWORD = 'P@ssw0rd123';

/** Authorization header value for a token. */
export function bearer(token: string): string {
  return `Bearer ${token}`;
}

/**
 * Register one account through the real `POST /auth/register` controller and
 * return everything a test needs to act as that user.
 */
export async function registerUser(
  app: INestApplication,
  overrides: Partial<Pick<TestUser, 'email' | 'password' | 'displayName'>> = {},
): Promise<TestUser> {
  const email = overrides.email ?? randomEmail();
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const displayName = overrides.displayName ?? email.split('@')[0];

  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, displayName })
    .expect(201);

  return {
    id: res.body.user.id,
    email,
    password,
    displayName,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
}

/**
 * Flow 0 util: create `count` random users via the register endpoint.
 * Sequential on purpose — registration hashes with bcrypt (cost 12) and we
 * want deterministic, isolated accounts per run.
 */
export async function createRandomUsers(
  app: INestApplication,
  count: number,
): Promise<TestUser[]> {
  const users: TestUser[] = [];
  for (let i = 0; i < count; i += 1) {
    users.push(await registerUser(app));
  }
  return users;
}

/** Log an existing user in again (fresh token pair). */
export async function loginUser(
  app: INestApplication,
  email: string,
  password = DEFAULT_PASSWORD,
): Promise<TestUser['accessToken']> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.accessToken;
}
