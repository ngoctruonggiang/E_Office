import { FieldType, FlowMode, SelectMode, TaskType } from '@prisma/client';

/** Unique-ish label so repeated runs never collide on a form name. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * A representative "Leave Request" form covering the three scalar field types
 * plus a SELECT with options. Used as the template for most request tests.
 */
export function buildFormPayload(name: string = uniqueName('Leave Request')) {
  return {
    name,
    fields: [
      {
        key: 'reason',
        label: 'Reason',
        type: FieldType.TEXT,
        required: true,
        maxLength: 200,
        placeholder: 'Why are you requesting leave?',
      },
      {
        key: 'days',
        label: 'Number of days',
        type: FieldType.NUMBER,
        required: true,
        min: 1,
        max: 30,
      },
      {
        key: 'leaveType',
        label: 'Leave type',
        type: FieldType.SELECT,
        selectMode: SelectMode.SINGLE,
        options: [
          { label: 'Annual', value: 'annual' },
          { label: 'Sick', value: 'sick' },
        ],
      },
    ],
  };
}

/** EAV values that satisfy {@link buildFormPayload}. */
export function buildRequestValues() {
  return [
    { fieldKey: 'reason', value: 'Family trip' },
    { fieldKey: 'days', value: 3 },
    { fieldKey: 'leaveType', value: 'annual' },
  ];
}

/** A PARALLEL approval step: everyone gets a task at once. */
export function parallelStep(
  order: number,
  userIds: string[],
  type: TaskType = TaskType.APPROVAL,
) {
  return {
    order,
    mode: FlowMode.PARALLEL,
    assignees: userIds.map((userId) => ({ userId, type })),
  };
}

/** A SEQUENTIAL approval step: assignees act one at a time, in `order`. */
export function sequentialStep(
  order: number,
  userIds: string[],
  type: TaskType = TaskType.APPROVAL,
) {
  return {
    order,
    mode: FlowMode.SEQUENTIAL,
    assignees: userIds.map((userId, i) => ({ userId, order: i + 1, type })),
  };
}
