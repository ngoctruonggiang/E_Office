import {
  BadGatewayException,
  GatewayTimeoutException,
  NotFoundException,
} from '@nestjs/common';
import { OperatonClientService } from './operaton-client.service';

describe('OperatonClientService', () => {
  let service: OperatonClientService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new OperatonClientService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('TC-OPR-U04: should throw GatewayTimeoutException on abort timeout', async () => {
    // Mock fetch to simulate an AbortError
    global.fetch = jest.fn().mockImplementation(() => {
      const error: any = new Error('The operation was aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    await expect(service.getVersion()).rejects.toThrow(GatewayTimeoutException);
  });

  it('should throw NotFoundException on 404 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: jest.fn().mockResolvedValue('Process definition not found'),
    } as any);

    await expect(service.getDefinitionXml('missing_id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadGatewayException on 500 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: jest.fn().mockResolvedValue('Engine execution failure'),
    } as any);

    await expect(service.getVersion()).rejects.toThrow(BadGatewayException);
  });

  it('should return version data on 200 OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ version: '2.2.1' }),
    } as any);

    const result = await service.getVersion();
    expect(result.version).toBe('2.2.1');
  });
});

