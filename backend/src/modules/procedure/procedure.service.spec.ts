import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProcedureService } from './procedure.service';

describe('ProcedureService', () => {
  let service: ProcedureService;
  let mockPrisma: any;
  let mockOperatonService: any;
  let mockValidationService: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn((cb) => cb(mockPrisma)),
      procedure: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      procedureVersion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      procedureActorMapping: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      procedureVariableMapping: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      form: {
        findMany: jest.fn(),
      },
    };

    mockOperatonService = {
      getDefinitions: jest.fn(),
      getDefinitionXml: jest.fn(),
      getDefinitionStructure: jest.fn(),
    };

    mockValidationService = {
      validate: jest.fn(),
    };

    service = new ProcedureService(
      mockPrisma,
      mockOperatonService,
      mockValidationService,
    );
  });

  it('TC-PRC-U01: should create procedure and initialize draft v1', async () => {
    mockPrisma.procedure.findUnique.mockResolvedValue(null);
    mockPrisma.procedure.create.mockResolvedValue({
      id: 'proc-1',
      code: 'PROC_01',
      name: 'Test Procedure',
    });
    mockPrisma.procedureVersion.create.mockResolvedValue({
      id: 'v1',
      procedureId: 'proc-1',
      version: 1,
      status: 'DRAFT',
    });

    const result = await service.create('user-1', {
      code: 'proc_01',
      name: 'Test Procedure',
    });

    expect(result.code).toBe('PROC_01');
    expect(result.draftVersion).toBeDefined();
    expect(result.draftVersion.version).toBe(1);
    expect(result.draftVersion.status).toBe('DRAFT');
  });

  it('TC-PRC-U02: should throw ConflictException when code already exists', async () => {
    mockPrisma.procedure.findUnique.mockResolvedValue({ id: 'proc-existing' });

    await expect(
      service.create('user-1', { code: 'PROC_01', name: 'Existing' }),
    ).rejects.toThrow(ConflictException);
  });

  it('TC-PRC-U04: should throw ForbiddenException when updating published version', async () => {
    mockPrisma.procedureVersion.findUnique.mockResolvedValue({
      id: 'v1',
      status: 'PUBLISHED', // not DRAFT!
    });

    await expect(
      service.updateDraftVersion('v1', {
        actorMappings: [],
        variableMappings: [],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('TC-PRC-U10: should create draft version incrementing version number and cloning mappings', async () => {
    mockPrisma.procedure.findUnique.mockResolvedValue({
      id: 'proc-1',
      code: 'PROC_01',
      name: 'Procedure',
      activeVersion: {
        id: 'v1',
        version: 1,
        formVersionId: 'fv-1',
        operatonDefinitionId: 'op-1',
        actorMappings: [
          {
            taskDefinitionKey: 'step_1',
            taskName: 'Review',
            order: 1,
            assigneeType: 'DIRECT_USER',
            defaultUserId: 'user-1',
            allowOverride: true,
            required: true,
          },
        ],
        variableMappings: [
          {
            operatonVarName: 'var_amount',
            formFieldKey: 'amount',
            variableType: 'NUMBER',
          },
        ],
      },
    });

    // No existing DRAFT
    mockPrisma.procedureVersion.findFirst.mockResolvedValue(null);
    mockPrisma.procedureVersion.aggregate.mockResolvedValue({
      _max: { version: 1 },
    });

    mockPrisma.procedureVersion.create.mockResolvedValue({
      id: 'v2',
      procedureId: 'proc-1',
      version: 2,
      status: 'DRAFT',
    });

    const result = await service.createDraftVersion('proc-1', 'admin-id');
    expect(mockPrisma.procedureVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          procedureId: 'proc-1',
          version: 2,
          status: 'DRAFT',
          formVersionId: 'fv-1',
          operatonDefinitionId: 'op-1',
        }),
      }),
    );
    expect(mockPrisma.procedureActorMapping.createMany).toHaveBeenCalled();
    expect(mockPrisma.procedureVariableMapping.createMany).toHaveBeenCalled();
  });
});

