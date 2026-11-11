import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FormResponse,
  RequestDocSection,
  RequestStatus,
  TaskAction,
  TaskStatus,
  TaskType,
} from '@prisma/client';
import { FlowStatusDto } from '../../approval-flow/dto/flow-status.dto';

/** One attached document with its section + signing role within the request. */
export class RequestDocumentView {
  @ApiProperty()
  documentId!: string;

  @ApiProperty({
    enum: RequestDocSection,
    description: 'MAIN (core content) or SECONDARY (supporting file).',
  })
  section!: RequestDocSection;

  @ApiProperty({
    description: 'True for the document carrying online-signature boxes.',
  })
  signing!: boolean;
}

export class RequestValueView {
  @ApiProperty()
  fieldKey!: string;

  @ApiProperty({
    description: 'Arbitrary JSON value; shape depends on field type.',
  })
  value!: unknown;
}

/** List item — lightweight request summary. */
export class RequestSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: RequestStatus })
  status!: RequestStatus;

  @ApiProperty({
    description: 'The form category (kind of form) this request is filling in.',
  })
  formId!: string;

  @ApiProperty()
  formName!: string;

  @ApiProperty()
  formVersionId!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  createdById!: string;

  @ApiProperty({ nullable: true, type: String })
  clonedFromId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'How this request was cloned from its parent: reset | reserve.',
  })
  cloneMode!: string | null;

  @ApiProperty()
  createdAt!: Date;

  // ── duty scope only: the caller's own task ("duty") on this request ───────

  @ApiPropertyOptional({
    enum: TaskStatus,
    nullable: true,
    description:
      "The caller's task status on this request (the duty list only). PENDING " +
      '= not yet acted, DONE = satisfied, CANCELLED = voided by the flow.',
  })
  dutyStatus?: TaskStatus | null;

  @ApiPropertyOptional({
    enum: TaskAction,
    nullable: true,
    description: 'The action the caller took on their duty (null until acted).',
  })
  dutyAction?: TaskAction | null;

  @ApiPropertyOptional({
    enum: TaskType,
    nullable: true,
    description: "The duty kind — APPROVAL or ACTION (from the caller's task).",
  })
  dutyType?: TaskType | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Date,
    description: "When the caller's duty was created (the action was assigned).",
  })
  dutyCreatedAt?: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Date,
    description: 'When the caller acted on their duty (null until acted).',
  })
  dutyActedAt?: Date | null;
}

/** Full request with its EAV values and its full approval flow state. */
export class RequestDetailDto extends RequestSummaryDto {
  @ApiProperty({ type: () => RequestValueView, isArray: true })
  values!: RequestValueView[];

  @ApiProperty({ type: String, isArray: true })
  viewerIds!: string[];

  @ApiProperty({ type: String, isArray: true })
  documentIds!: string[];

  @ApiProperty({ type: () => RequestDocumentView, isArray: true })
  documents!: RequestDocumentView[];

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The attached document designated for online signing (null when none).',
  })
  signatureDocumentId!: string | null;

  @ApiProperty({
    type: () => FlowStatusDto,
    description:
      "The request's full approval flow — steps, assignees and their tasks.",
  })
  flow!: FlowStatusDto;
}

/** Shape of a request row joined with form + values (query payload). */
export type RequestWithRelations = FormResponse & {
  formVersion: { version: number; form: { id: string; name: string } };
  values?: { fieldKey: string; value: unknown }[];
  viewers?: { userId: string }[];
  documents?: { documentId: string }[];
};
