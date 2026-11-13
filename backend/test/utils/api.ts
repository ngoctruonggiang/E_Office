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

export function getFormVersion(
  app: INestApplication,
  token: string,
  versionId: string,
) {
  return request(app.getHttpServer())
    .get(`/forms/versions/${versionId}`)
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

// ── operaton ─────────────────────────────────────────────────────────────

export function getOperatonHealth(app: INestApplication, token: string) {
  return request(app.getHttpServer())
    .get('/operaton/health')
    .set('Authorization', bearer(token));
}

export function getOperatonDefinitions(
  app: INestApplication,
  token: string,
  category = 'e-Office',
) {
  return request(app.getHttpServer())
    .get(`/operaton/definitions?category=${encodeURIComponent(category)}`)
    .set('Authorization', bearer(token));
}

export function getOperatonDefinitionXml(
  app: INestApplication,
  token: string,
  definitionId: string,
) {
  return request(app.getHttpServer())
    .get(`/operaton/definitions/${encodeURIComponent(definitionId)}/xml`)
    .set('Authorization', bearer(token));
}

export function getOperatonDefinitionStructure(
  app: INestApplication,
  token: string,
  definitionId: string,
) {
  return request(app.getHttpServer())
    .get(`/operaton/definitions/${encodeURIComponent(definitionId)}/structure`)
    .set('Authorization', bearer(token));
}

export function deployOperatonWorkflow(
  app: INestApplication,
  token: string,
  body: unknown,
) {
  return request(app.getHttpServer())
    .post('/operaton/deploy')
    .set('Authorization', bearer(token))
    .send(body);
}

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

export function submitDraft(
  app: INestApplication,
  token: string,
  id: string,
  body: unknown = {},
) {
  return request(app.getHttpServer())
    .post(`/requests/${id}/submit`)
    .set('Authorization', bearer(token))
    .send(body);
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

// ── procedure controller ───────────────────────────────────────────────────

export function createProcedure(
  app: INestApplication,
  token: string,
  body: unknown,
) {
  return request(app.getHttpServer())
    .post('/procedures')
    .set('Authorization', bearer(token))
    .send(body as any);
}

export function getProcedure(
  app: INestApplication,
  token: string,
  id: string,
) {
  return request(app.getHttpServer())
    .get(`/procedures/${id}`)
    .set('Authorization', bearer(token));
}

export function listProcedures(
  app: INestApplication,
  token: string,
  query?: Record<string, any>,
) {
  const req = request(app.getHttpServer())
    .get('/procedures')
    .set('Authorization', bearer(token));
  return query ? req.query(query) : req;
}

export function getProcedureVersion(
  app: INestApplication,
  token: string,
  versionId: string,
) {
  return request(app.getHttpServer())
    .get(`/procedures/versions/${versionId}`)
    .set('Authorization', bearer(token));
}

export function updateProcedureVersion(
  app: INestApplication,
  token: string,
  versionId: string,
  body: unknown,
) {
  return request(app.getHttpServer())
    .put(`/procedures/versions/${versionId}`)
    .set('Authorization', bearer(token))
    .send(body as any);
}

export function validateProcedureVersion(
  app: INestApplication,
  token: string,
  versionId: string,
) {
  return request(app.getHttpServer())
    .post(`/procedures/versions/${versionId}/validate`)
    .set('Authorization', bearer(token));
}

export function publishProcedureVersion(
  app: INestApplication,
  token: string,
  versionId: string,
) {
  return request(app.getHttpServer())
    .post(`/procedures/versions/${versionId}/publish`)
    .set('Authorization', bearer(token));
}

export function createProcedureDraftVersion(
  app: INestApplication,
  token: string,
  procedureId: string,
) {
  return request(app.getHttpServer())
    .post(`/procedures/${procedureId}/draft`)
    .set('Authorization', bearer(token));
}

export function getProcedureDirectory(
  app: INestApplication,
  token: string,
  query?: Record<string, any>,
) {
  const req = request(app.getHttpServer())
    .get('/procedures/helpers/directory')
    .set('Authorization', bearer(token));
  return query ? req.query(query) : req;
}

