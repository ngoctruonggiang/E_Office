import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import {
  bearer,
  createRandomUsers,
  loginUser,
  registerUser,
  TestUser,
} from './utils/auth.helper';

/**
 * Flow 0 — populate the system with users.
 *
 * Exercises the register util (`createRandomUsers`) that the other flows rely
 * on, and confirms the tokens it hands back are genuinely usable against a
 * protected route.
 */
describe('Flow 0 — user population (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers 10 random users, each with a distinct id and token', async () => {
    const users = await createRandomUsers(app, 10);

    expect(users).toHaveLength(10);

    const ids = new Set(users.map((u) => u.id));
    const emails = new Set(users.map((u) => u.email));
    expect(ids.size).toBe(10);
    expect(emails.size).toBe(10);

    for (const user of users) {
      expect(typeof user.accessToken).toBe('string');
      expect(user.accessToken.length).toBeGreaterThan(0);
    }
  });

  it('issues access tokens that authenticate against GET /users/me', async () => {
    const [user] = await createRandomUsers(app, 1);

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', bearer(user.accessToken))
      .expect(200);

    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe(user.email);
    expect(res.body.displayName).toBe(user.displayName);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('rejects protected routes without a token (401)', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('rejects a duplicate email registration (409)', async () => {
    const user: TestUser = await registerUser(app);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: user.email, password: 'AnotherP@ss1' })
      .expect(409);
  });

  it('lets a registered user log back in and reuse the new token', async () => {
    const user = await registerUser(app);

    const freshToken = await loginUser(app, user.email, user.password);

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', bearer(freshToken))
      .expect(200);
    expect(res.body.id).toBe(user.id);
  });
});
