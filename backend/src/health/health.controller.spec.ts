import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns ok status', async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    expect(moduleRef.get(HealthController).check()).toEqual({ status: 'ok' });
  });
});
