import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin server-side client for the Documenso v1 REST API.
 *
 * gafood is the auth bridge: it holds ONE Documenso API token and performs
 * every Documenso call on behalf of users. The frontend never talks to
 * Documenso directly.
 */

export interface DocumensoRecipient {
  recipientId?: number;
  id?: number;
  name: string;
  email: string;
  role: string;
  token: string;
  signingUrl: string;
  signingStatus?: string;
  signedAt?: string | null;
}

export interface CreateDocumentResult {
  uploadUrl: string;
  documentId: number;
  recipients: DocumensoRecipient[];
}

export interface DocumensoFieldInput {
  recipientId: number;
  type: string;
  pageNumber: number;
  pageX: number;
  pageY: number;
  pageWidth: number;
  pageHeight: number;
  fieldMeta?: Record<string, unknown>;
}

export interface DocumensoDocument {
  id: number;
  status: string;
  recipients: DocumensoRecipient[];
}

@Injectable()
export class DocumensoClient {
  private readonly logger = new Logger(DocumensoClient.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('DOCUMENSO_API_URL') ?? 'http://localhost:3333'
    ).replace(/\/$/, '');
    this.token = config.get<string>('DOCUMENSO_API_TOKEN') ?? '';

    if (!this.token) {
      this.logger.warn(
        'DOCUMENSO_API_TOKEN is not set — signing endpoints will fail.',
      );
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();

    if (!res.ok) {
      this.logger.error(
        `Documenso ${method} ${path} failed (${res.status}): ${text}`,
      );
      throw new InternalServerErrorException(
        `Documenso request failed (${res.status})`,
      );
    }

    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** Create a draft document (no recipients yet) and get a presigned upload URL. */
  createDocument(title: string): Promise<CreateDocumentResult> {
    return this.request<CreateDocumentResult>('POST', '/api/v1/documents', {
      title,
      recipients: [],
    });
  }

  createRecipient(
    documentId: number,
    recipient: { name: string; email: string; role?: string },
  ): Promise<DocumensoRecipient> {
    return this.request<DocumensoRecipient>(
      'POST',
      `/api/v1/documents/${documentId}/recipients`,
      { role: 'SIGNER', ...recipient },
    );
  }

  createFields(
    documentId: number,
    fields: DocumensoFieldInput[],
  ): Promise<unknown> {
    return this.request(
      'POST',
      `/api/v1/documents/${documentId}/fields`,
      fields.length === 1 ? fields[0] : fields,
    );
  }

  sendDocument(documentId: number): Promise<unknown> {
    // sendEmail:false — internal-only deploy has no SMTP; signers reach the
    // signing page via the link surfaced by the gafood FE (recipient.signingUrl).
    return this.request('POST', `/api/v1/documents/${documentId}/send`, {
      sendEmail: false,
    });
  }

  getDocument(documentId: number): Promise<DocumensoDocument> {
    return this.request<DocumensoDocument>(
      'GET',
      `/api/v1/documents/${documentId}`,
    );
  }

  /**
   * Presigned S3 download URL. Documenso only produces a sealed PDF (with the
   * signatures flattened in) once the document is completed; pass
   * `original = true` to fetch the unsigned original before then.
   */
  getDownloadUrl(
    documentId: number,
    original = false,
  ): Promise<{ downloadUrl: string }> {
    const query = original ? '?downloadOriginalDocument=true' : '';
    return this.request<{ downloadUrl: string }>(
      'GET',
      `/api/v1/documents/${documentId}/download${query}`,
    );
  }
}
