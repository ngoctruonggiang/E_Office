import { INestApplication } from '@nestjs/common';
import { TaskAction } from '@prisma/client';
import request from 'supertest';
import { bearer } from './auth.helper';

/**
 * Thin wrappers over the HTTP endpoints under test. Each takes the acting
 * user's access token so the spec reads as "user X does Y". `.expect(status)`
 * is left to the caller so negative cases can assert 4xx.
 */

// ── forms ──────────────────────────────────────────────────────────────────

export function createForm(app: INestApplication, token: string, body: unknown) {
  return request(app.getHttpServer())
    .post('/forms')
    .set('Authorization', bearer(token))
    .send(body);
}

export function getForm(app: INestApplication, token: string, formId: string) {
  return request(app.getHttpServer())
    .get(`/forms/${formId}`)
    .set('Authorization', bearer(token));
}

export function updateForm(
  app: INestApplication,
  token: string,
  formId: string,
  body: unknown,
) {
  return request(app.getHttpServer())
    .patch(`/forms/${formId}`)
    .set('Authorization', bearer(token))
    .send(body);
}

// ── requests ─────────────────────────────────────────────────────────────

export function createRequest(
  app: INestApplication,
  token: string,
  body: unknown,
) {
  return request(app.getHttpServer())
    .post('/requests')
    .set('Authorization', bearer(token))
    .send(body);
}

export function getRequest(app: INestApplication, token: string, id: string) {
  return request(app.getHttpServer())
    .get(`/requests/${id}`)
    .set('Authorization', bearer(token));
}

export function updateRequest(
  app: INestApplication,
  token: string,
  id: string,
  body: unknown,
) {
  return request(app.getHttpServer())
    .patch(`/requests/${id}`)
    .set('Authorization', bearer(token))
    .send(body);
}

export function listMine(
  app: INestApplication,
  token: string,
  formId?: string,
) {
  const req = request(app.getHttpServer())
    .get('/requests/mine')
    .set('Authorization', bearer(token));
  return formId ? req.query({ formId }) : req;
}

export function listDuty(
  app: INestApplication,
  token: string,
  formId?: string,
) {
  const req = request(app.getHttpServer())
    .get('/requests/duty')
    .set('Authorization', bearer(token));
  return formId ? req.query({ formId }) : req;
}

export function listViewable(
  app: INestApplication,
  token: string,
  formId?: string,
) {
  const req = request(app.getHttpServer())
    .get('/requests/viewable')
    .set('Authorization', bearer(token));
  return formId ? req.query({ formId }) : req;
}

export function act(
  app: INestApplication,
  token: string,
  id: string,
  action: TaskAction,
) {
  return request(app.getHttpServer())
    .post(`/requests/${id}/approval`)
    .set('Authorization', bearer(token))
    .send({ action });
}

export function cloneReserve(
  app: INestApplication,
  token: string,
  id: string,
) {
  return request(app.getHttpServer())
    .post(`/requests/${id}/clone-reserve`)
    .set('Authorization', bearer(token));
}

export function cloneReset(app: INestApplication, token: string, id: string) {
  return request(app.getHttpServer())
    .post(`/requests/${id}/clone-reset`)
    .set('Authorization', bearer(token));
}

// ── approval-flow controller (read-only status) ────────────────────────────

export function getFlowStatus(
  app: INestApplication,
  token: string,
  requestId: string,
) {
  return request(app.getHttpServer())
    .get(`/approval-flows/${requestId}`)
    .set('Authorization', bearer(token));
}
