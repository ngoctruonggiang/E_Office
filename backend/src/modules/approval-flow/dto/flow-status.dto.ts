import { ApiProperty } from '@nestjs/swagger';
import {
  FlowMode,
  RequestStatus,
  TaskAction,
  TaskStatus,
  TaskType,
} from '@prisma/client';

class FlowTaskAssigneeView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;
}

export class FlowTaskView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  stepOrder!: number;

  @ApiProperty({ enum: FlowMode })
  stepMode!: FlowMode;

  @ApiProperty({ type: () => FlowTaskAssigneeView })
  assignee!: { id: string; email: string; displayName: string | null };

  @ApiProperty({ enum: TaskType })
  type!: TaskType;

  @ApiProperty({ enum: TaskStatus })
  status!: TaskStatus;

  @ApiProperty({ enum: TaskAction, nullable: true })
  action!: TaskAction | null;

  @ApiProperty({ nullable: true, type: Date })
  actedAt!: Date | null;
}

/** One assignee within a step blueprint, merged with their task state (if any). */
export class FlowStepAssigneeView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ enum: TaskType })
  type!: TaskType;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Execution order within a SEQUENTIAL step.',
  })
  order!: number | null;

  @ApiProperty({
    enum: TaskStatus,
    nullable: true,
    description: 'null when this assignee has no task yet (not reached).',
  })
  status!: TaskStatus | null;

  @ApiProperty({ enum: TaskAction, nullable: true })
  action!: TaskAction | null;

  @ApiProperty({ nullable: true, type: Date })
  actedAt!: Date | null;
}

/**
 * Full step of the flow blueprint (every step + every assignee, regardless of
 * activation), so the frontend can render the planned flow — not just the
 * tasks created so far.
 */
export class FlowStepStatusView {
  @ApiProperty()
  order!: number;

  @ApiProperty({ enum: FlowMode })
  mode!: FlowMode;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Optional creator-given label for this step.',
  })
  name!: string | null;

  @ApiProperty({
    description:
      'The final step: completing it (its approver signs/approves) closes the request.',
  })
  isFinal!: boolean;

  @ApiProperty({
    description:
      'Whether this step must be completed for the request to close. The final step is always required.',
  })
  required!: boolean;

  @ApiProperty({ description: 'Whether this is the currently active step.' })
  isCurrent!: boolean;

  @ApiProperty({ type: () => FlowStepAssigneeView, isArray: true })
  assignees!: FlowStepAssigneeView[];
}

/** Status snapshot of a request's approval flow (get-by-requestId). */
export class FlowStatusDto {
  @ApiProperty()
  requestId!: string;

  @ApiProperty({ enum: RequestStatus })
  requestStatus!: RequestStatus;

  /** false when the requester didn't build an approval flow for this request. */
  @ApiProperty({
    description:
      "false when the requester didn't build an approval flow for this request.",
  })
  hasFlow!: boolean;

  @ApiProperty()
  isDone!: boolean;

  /** `order` of the currently active step (null when no flow / finished). */
  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Order of the currently active step (null when no flow / finished).',
  })
  currentStep!: number | null;

  @ApiProperty({ type: () => FlowTaskView, isArray: true })
  tasks!: FlowTaskView[];

  /**
   * The full planned flow (every step + assignee), each assignee merged with
   * their task state. Empty when the request has no flow.
   */
  @ApiProperty({ type: () => FlowStepStatusView, isArray: true })
  steps!: FlowStepStatusView[];
}
