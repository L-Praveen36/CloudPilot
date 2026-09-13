import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentService } from './environment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../security/crypto.service';
import { ConfigService } from '@nestjs/config';

describe('EnvironmentService', () => {
  let service: EnvironmentService;
  let crypto: CryptoService;

  const mockPrisma = {
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: 'proj-123', userId: 'user-123' }),
    },
    environment: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    environmentVariable: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentService,
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('01234567890123456789012345678901'), // 32 bytes
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<EnvironmentService>(EnvironmentService);
    crypto = module.get<CryptoService>(CryptoService);
    crypto.initKey('01234567890123456789012345678901');
  });

  it('should ensure default environments and list them', async () => {
    mockPrisma.environment.findMany.mockResolvedValue([
      {
        id: 'env-prod',
        projectId: 'proj-123',
        name: 'production',
        type: 'PRODUCTION',
        branchPattern: 'main',
        autoDeployEnabled: false,
        autoRollbackEnabled: false,
        maxRollbackAttempts: 1,
        _count: { variables: 2 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const envs = await service.getEnvironments('user-123', 'proj-123');
    expect(envs).toHaveLength(1);
    expect(envs[0].name).toBe('production');
    expect(envs[0].variablesCount).toBe(2);
  });

  it('should create a custom environment with valid name and branchPattern', async () => {
    mockPrisma.environment.findFirst.mockResolvedValueOnce(null);
    mockPrisma.environment.create.mockResolvedValueOnce({
      id: 'env-staging',
      projectId: 'proj-123',
      name: 'staging',
      type: 'STAGING',
      branchPattern: 'staging',
      autoDeployEnabled: true,
      autoRollbackEnabled: true,
      maxRollbackAttempts: 2,
      _count: { variables: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const env = await service.createEnvironment('user-123', 'proj-123', {
      name: 'staging',
      type: 'STAGING',
      branchPattern: 'staging',
      autoDeployEnabled: true,
      autoRollbackEnabled: true,
      maxRollbackAttempts: 2,
    });

    expect(env.name).toBe('staging');
    expect(env.autoDeployEnabled).toBe(true);
    expect(env.autoRollbackEnabled).toBe(true);
  });

  it('should encrypt environment variables and return masked values in public DTOs', async () => {
    mockPrisma.environment.findFirst.mockResolvedValueOnce({ id: 'env-1', projectId: 'proj-123' });

    mockPrisma.environmentVariable.upsert.mockResolvedValueOnce({
      id: 'var-1',
      environmentId: 'env-1',
      key: 'DATABASE_URL',
      encryptedValue: crypto.encrypt('postgres://user:pass@localhost:5432/db'),
      isSecret: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const createdVar = await service.setEnvironmentVariable('user-123', 'proj-123', 'env-1', {
      key: 'DATABASE_URL',
      value: 'postgres://user:pass@localhost:5432/db',
      isSecret: true,
    });

    expect(createdVar.key).toBe('DATABASE_URL');
    expect(createdVar.maskedValue).toBe('••••••••');
    expect(createdVar.isConfigured).toBe(true);
    expect(createdVar).not.toHaveProperty('encryptedValue');
  });

  it('should decrypt variables for internal container execution', async () => {
    const rawSecret = 'secret-api-key-12345';
    mockPrisma.environmentVariable.findMany.mockResolvedValueOnce([
      {
        id: 'var-1',
        environmentId: 'env-1',
        key: 'API_KEY',
        encryptedValue: crypto.encrypt(rawSecret),
        isSecret: true,
      },
    ]);

    const decrypted = await service.getDecryptedVariablesForExecution('env-1');
    expect(decrypted.API_KEY).toBe(rawSecret);
  });

  it('should create and update PREVIEW environment correctly', async () => {
    mockPrisma.environment.findFirst.mockResolvedValueOnce(null);
    mockPrisma.environment.create.mockResolvedValueOnce({
      id: 'env-prev-1',
      projectId: 'proj-123',
      name: 'preview-pr-12',
      type: 'PREVIEW',
      branchPattern: 'preview/*',
      autoDeployEnabled: true,
      autoRollbackEnabled: false,
      maxRollbackAttempts: 1,
      _count: { variables: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const env = await service.createEnvironment('user-123', 'proj-123', {
      name: 'preview-pr-12',
      type: 'PREVIEW',
      branchPattern: 'preview/*',
    });

    expect(env.type).toBe('PREVIEW');
    expect(env.name).toBe('preview-pr-12');
  });

  it('should create and update CUSTOM environment correctly', async () => {
    mockPrisma.environment.findFirst.mockResolvedValueOnce(null);
    mockPrisma.environment.create.mockResolvedValueOnce({
      id: 'env-custom-1',
      projectId: 'proj-123',
      name: 'qa-environment',
      type: 'CUSTOM',
      branchPattern: 'qa',
      autoDeployEnabled: false,
      autoRollbackEnabled: false,
      maxRollbackAttempts: 1,
      _count: { variables: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const env = await service.createEnvironment('user-123', 'proj-123', {
      name: 'qa-environment',
      type: 'CUSTOM',
      branchPattern: 'qa',
    });

    expect(env.type).toBe('CUSTOM');
    expect(env.name).toBe('qa-environment');
  });

  it('should enforce cross-user isolation when accessing unowned project', async () => {
    mockPrisma.project.findFirst.mockResolvedValueOnce(null);

    await expect(service.getEnvironments('user-unauthorized', 'proj-123')).rejects.toThrow();
  });
});
