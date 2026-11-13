import { ProcedureValidationService } from './procedure-validation.service';

describe('ProcedureValidationService', () => {
  let service: ProcedureValidationService;
  let mockPrisma: any;
  let mockOperatonService: any;

  beforeEach(() => {
    mockPrisma = {
      procedureVersion: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    mockOperatonService = {
      getDefinitionStructure: jest.fn(),
    };

    service = new ProcedureValidationService(mockPrisma, mockOperatonService);
  });

  it('should return error VAL-PRC-00 if version does not exist', async () => {
    mockPrisma.procedureVersion.findUnique.mockResolvedValue(null);

    const result = await service.validate('non-existent-id');
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'VAL-PRC-00' }),
      ]),
    );
  });

  it('should return error VAL-PRC-01 if FormVersion is missing or has no fields', async () => {
    mockPrisma.procedureVersion.findUnique.mockResolvedValue({
      id: 'v1',
      formVersionId: null,
      formVersion: null,
      operatonDefinitionId: 'def-1',
      actorMappings: [],
      variableMappings: [],
    });

    const result = await service.validate('v1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'VAL-PRC-01' }),
      ]),
    );
  });

  it('should return error VAL-PRC-02 if Operaton workflow is not found', async () => {
    mockPrisma.procedureVersion.findUnique.mockResolvedValue({
      id: 'v1',
      formVersionId: 'fv-1',
      formVersion: {
        fields: [{ key: 'amount', type: 'NUMBER' }],
      },
      operatonDefinitionId: null,
      actorMappings: [],
      variableMappings: [],
    });

    const result = await service.validate('v1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'VAL-PRC-02' }),
      ]),
    );
  });

  it('TC-PRC-U05: should detect missing condition variables (VAL-PRC-03)', async () => {
    mockPrisma.procedureVersion.findUnique.mockResolvedValue({
      id: 'v1',
      formVersionId: 'fv-1',
      operatonDefinitionId: 'def-1',
      formVersion: {
        fields: [{ key: 'amount', type: 'NUMBER' }],
      },
      variableMappings: [], // empty mappings!
      actorMappings: [
        {
          taskDefinitionKey: 'step_1',
          taskName: 'Step 1',
          allowOverride: true,
          required: true,
          defaultUserId: 'user-1',
        },
      ],
    });

    mockOperatonService.getDefinitionStructure.mockResolvedValue({
      conditionVariables: ['var_amount', 'var_days'],
      tasks: [{ id: 'step_1', name: 'Step 1' }],
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
    });

    const result = await service.validate('v1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'VAL-PRC-03',
          field: 'variableMappings.var_amount',
        }),
        expect.objectContaining({
          code: 'VAL-PRC-03',
          field: 'variableMappings.var_days',
        }),
      ]),
    );
  });

  it('TC-PRC-U06: should detect when mapped form field does not exist in Form (VAL-PRC-04)', async () => {
    mockPrisma.procedureVersion.findUnique.mockResolvedValue({
      id: 'v1',
      formVersionId: 'fv-1',
      operatonDefinitionId: 'def-1',
      formVersion: {
        fields: [{ key: 'amount', type: 'NUMBER' }],
      },
      variableMappings: [
        {
          operatonVarName: 'var_amount',
          formFieldKey: 'non_existent_field', // invalid key
          variableType: 'NUMBER',
        },
      ],
      actorMappings: [
        {
          taskDefinitionKey: 'step_1',
          taskName: 'Step 1',
          allowOverride: true,
          required: true,
          defaultUserId: 'user-1',
        },
      ],
    });

    mockOperatonService.getDefinitionStructure.mockResolvedValue({
      conditionVariables: ['var_amount'],
      tasks: [{ id: 'step_1', name: 'Step 1' }],
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
    });

    const result = await service.validate('v1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'VAL-PRC-04',
          field: 'variableMappings.var_amount',
        }),
      ]),
    );
  });

  it('TC-PRC-U07: should fail if non-overridable step lacks defaultUserId (VAL-PRC-07)', async () => {
    mockPrisma.procedureVersion.findUnique.mockResolvedValue({
      id: 'v1',
      formVersionId: 'fv-1',
      operatonDefinitionId: 'def-1',
      formVersion: {
        fields: [{ key: 'amount', type: 'NUMBER' }],
      },
      variableMappings: [
        {
          operatonVarName: 'var_amount',
          formFieldKey: 'amount',
          variableType: 'NUMBER',
        },
      ],
      actorMappings: [
        {
          taskDefinitionKey: 'step_locked',
          taskName: 'Locked Step',
          allowOverride: false, // Locked
          required: true,
          defaultUserId: null, // Missing!
        },
      ],
    });

    mockOperatonService.getDefinitionStructure.mockResolvedValue({
      conditionVariables: ['var_amount'],
      tasks: [{ id: 'step_locked', name: 'Locked Step' }],
    });

    const result = await service.validate('v1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'VAL-PRC-07',
          field: 'actorMappings.step_locked',
        }),
      ]),
    );
  });

  it('TC-PRC-U08: should fail if assigned default user is inactive (VAL-PRC-08)', async () => {
    mockPrisma.procedureVersion.findUnique.mockResolvedValue({
      id: 'v1',
      formVersionId: 'fv-1',
      operatonDefinitionId: 'def-1',
      formVersion: {
        fields: [{ key: 'amount', type: 'NUMBER' }],
      },
      variableMappings: [
        {
          operatonVarName: 'var_amount',
          formFieldKey: 'amount',
          variableType: 'NUMBER',
        },
      ],
      actorMappings: [
        {
          taskDefinitionKey: 'step_1',
          taskName: 'Step 1',
          allowOverride: true,
          required: true,
          defaultUserId: 'user-disabled',
        },
      ],
    });

    mockOperatonService.getDefinitionStructure.mockResolvedValue({
      conditionVariables: ['var_amount'],
      tasks: [{ id: 'step_1', name: 'Step 1' }],
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-disabled',
      displayName: 'Nguyễn Văn Khóa',
      email: 'khoa@gafood.vn',
      isActive: false, // Inactive!
    });

    const result = await service.validate('v1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'VAL-PRC-08',
          field: 'actorMappings.step_1',
        }),
      ]),
    );
  });

  it('TC-PRC-U09: should pass with 100% valid configuration', async () => {
    mockPrisma.procedureVersion.findUnique.mockResolvedValue({
      id: 'v1',
      formVersionId: 'fv-1',
      operatonDefinitionId: 'def-1',
      formVersion: {
        fields: [{ key: 'amount', type: 'NUMBER', label: 'Số tiền' }],
      },
      variableMappings: [
        {
          operatonVarName: 'var_amount',
          formFieldKey: 'amount',
          variableType: 'NUMBER',
        },
      ],
      actorMappings: [
        {
          taskDefinitionKey: 'step_1',
          taskName: 'Step 1',
          allowOverride: true,
          required: true,
          defaultUserId: 'user-active',
        },
      ],
    });

    mockOperatonService.getDefinitionStructure.mockResolvedValue({
      conditionVariables: ['var_amount'],
      tasks: [{ id: 'step_1', name: 'Step 1' }],
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-active',
      displayName: 'Nguyễn Văn A',
      email: 'a@gafood.vn',
      isActive: true,
    });

    const result = await service.validate('v1');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

