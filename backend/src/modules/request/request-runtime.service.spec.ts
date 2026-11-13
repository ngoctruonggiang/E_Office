import { Test, TestingModule } from '@nestjs/testing';
import { RequestService } from './request.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ApprovalEngineService } from '../approval-flow/approval-engine.service';
import { OperatonClientService } from '../operaton/operaton-client.service';
import { BpmnParserService } from '../operaton/bpmn-parser.service';
import { FlowSimulationService } from './flow-simulation.service';
import { RequestStatus } from '@prisma/client';
import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';

describe('RequestService - Phase 5 Runtime & Signing', () => {
  let service: RequestService;
  let prisma: any;
  let operatonClient: any;
  let bpmnParser: any;
  let flowSimulation: any;

  beforeEach(async () => {
    prisma = {
      procedure: {
        findUnique: jest.fn(),
      },
      procedureVersion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      formResponse: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      formResponseValue: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      requestActualActor: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      taskProjection: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
      },
      signatureField: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      requestComment: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    operatonClient = {
      startInstance: jest.fn(),
      getActiveTasks: jest.fn(),
      completeTask: jest.fn(),
      deleteProcessInstance: jest.fn(),
    };

    bpmnParser = {
      parse: jest.fn(),
    };

    flowSimulation = {
      extractVariables: jest.fn(),
      evaluateCondition: jest.fn(),
      simulate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestService,
        { provide: PrismaService, useValue: prisma },
        { provide: ApprovalEngineService, useValue: {} },
        { provide: OperatonClientService, useValue: operatonClient },
        { provide: BpmnParserService, useValue: bpmnParser },
        { provide: FlowSimulationService, useValue: flowSimulation },
      ],
    }).compile();

    service = module.get<RequestService>(RequestService);
  });

  describe('createFromProcedure', () => {
    it('TC-RUN-U07: should create DRAFT request pinned to published ProcedureVersion and seed default actors', async () => {
      const mockVersion = {
        id: 'prcv-1',
        procedureId: 'prc-1',
        version: 1,
        status: 'PUBLISHED',
        formVersionId: 'fv-1',
        operatonDefinitionKey: 'FLOW_1_PURCHASE',
        procedure: { id: 'prc-1', code: 'PRC-01', name: 'Mua sắm', icon: 'cart' },
        formVersion: { id: 'fv-1', version: 1, layoutSchema: {} },
        actorMappings: [
          {
            taskDefinitionKey: 'Activity_DeptHeadApprove',
            taskName: 'Trưởng phòng duyệt',
            defaultUserId: 'usr-tp',
            order: 1,
            allowOverride: true,
            defaultUser: { id: 'usr-tp', department: 'Phòng Mua hàng', title: 'Trưởng phòng' },
          },
        ],
      };

      prisma.procedureVersion.findUnique.mockResolvedValue(mockVersion);
      prisma.formResponse.create.mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.DRAFT,
        createdAt: new Date(),
        formVersion: mockVersion.formVersion,
        procedureVersion: mockVersion,
      });

      prisma.requestActualActor.findMany.mockResolvedValue([
        {
          id: 'act-1',
          taskDefinitionKey: 'Activity_DeptHeadApprove',
          taskName: 'Trưởng phòng duyệt',
          userId: 'usr-tp',
          order: 1,
          isOverridden: false,
          user: { displayName: 'Trưởng phòng', email: 'tp@gafood.local' },
        },
      ]);

      const result = await service.createFromProcedure({ procedureVersionId: 'prcv-1' }, 'usr-nv');

      expect(result.id).toBe('req-1');
      expect(result.status).toBe(RequestStatus.DRAFT);
      expect(prisma.requestActualActor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskDefinitionKey: 'Activity_DeptHeadApprove',
            userId: 'usr-tp',
            isOverridden: false,
          }),
        }),
      );
    });
  });

  describe('setActualActors', () => {
    it('TC-RUN-U08: should throw ForbiddenException when user attempts to override an actor with allowOverride = false', async () => {
      prisma.formResponse.findUnique.mockResolvedValue({
        id: 'req-1',
        createdById: 'usr-nv',
        status: RequestStatus.DRAFT,
        procedureVersion: {
          actorMappings: [
            {
              taskDefinitionKey: 'Activity_DirectorApprove',
              taskName: 'Ban Giám đốc phê duyệt',
              allowOverride: false,
            },
          ],
        },
      });

      await expect(
        service.setActualActors(
          'req-1',
          [{ taskDefinitionKey: 'Activity_DirectorApprove', userId: 'usr-other' }],
          'usr-nv',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approveTask', () => {
    it('TC-RUN-U09: should throw UnprocessableEntityException (422) if pending SignatureField exists for approver', async () => {
      prisma.taskProjection.findUnique.mockResolvedValue({
        operatonTaskId: 'task-1',
        responseId: 'req-1',
        assigneeId: 'usr-tp',
        taskDefinitionKey: 'Activity_DeptHeadApprove',
        status: 'ACTIVE',
      });

      prisma.signatureField.findMany.mockResolvedValue([
        { id: 'sig-1', status: 'PENDING', assigneeId: 'usr-tp' },
      ]);

      await expect(
        service.approveTask('req-1', 'task-1', 'Duyệt', 'usr-tp'),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(operatonClient.completeTask).not.toHaveBeenCalled();
    });

    it('TC-RUN-U10: should complete task and advance state if no pending signature fields', async () => {
      prisma.taskProjection.findUnique.mockResolvedValue({
        operatonTaskId: 'task-1',
        responseId: 'req-1',
        processInstanceId: 'inst-1',
        assigneeId: 'usr-tp',
        taskDefinitionKey: 'Activity_DeptHeadApprove',
        status: 'ACTIVE',
      });

      prisma.signatureField.findMany.mockResolvedValue([]); // No pending signatures
      operatonClient.getActiveTasks.mockResolvedValue([]); // No more tasks, process completed

      const result = await service.approveTask('req-1', 'task-1', 'Duyệt', 'usr-tp');

      expect(operatonClient.completeTask).toHaveBeenCalledWith('task-1', {
        approved: { value: true, type: 'Boolean' },
      });
      expect(prisma.taskProjection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { operatonTaskId: 'task-1' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
      expect(result.status).toBe(RequestStatus.APPROVED);
    });
  });

  describe('rejectTask', () => {
    it('TC-RUN-U11: should terminate Operaton instance and cancel active TaskProjection rows', async () => {
      prisma.taskProjection.findUnique.mockResolvedValue({
        operatonTaskId: 'task-1',
        responseId: 'req-1',
        processInstanceId: 'inst-1',
        assigneeId: 'usr-tp',
        status: 'ACTIVE',
      });

      const result = await service.rejectTask('req-1', 'task-1', 'Không đủ ngân sách', 'usr-tp');

      expect(operatonClient.deleteProcessInstance).toHaveBeenCalledWith(
        'inst-1',
        expect.stringContaining('Không đủ ngân sách'),
      );
      expect(prisma.taskProjection.updateMany).toHaveBeenCalledWith({
        where: { responseId: 'req-1', status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.formResponse.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: RequestStatus.REJECTED },
      });
      expect(result.status).toBe(RequestStatus.REJECTED);
    });
  });
});

