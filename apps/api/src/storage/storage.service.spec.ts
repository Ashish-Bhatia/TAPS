import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service.js';

// The S3Client is mocked throughout — these tests cover the key-building,
// env-validation, and error-handling logic around it (TAPS-2.13's own
// scope). The one real, live call against the actual R2 bucket is this
// story's manual upload/fetch-back verification, not a unit test — it
// can't be, since it depends on real R2_* credentials.
const sendMock = vi.fn();
vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>();
  return {
    ...actual,
    S3Client: class {
      send = sendMock;
    },
  };
});

describe('StorageService', () => {
  let service: StorageService;
  const originalEnv = { ...process.env };
  const R2_VARS = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL',
  ] as const;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();
    service = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    for (const key of R2_VARS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  function setConfigured(): void {
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.R2_BUCKET_NAME = 'test-bucket';
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com';
  }

  it('fails loudly with InternalServerErrorException when R2 env vars are unset', async () => {
    for (const key of R2_VARS) delete process.env[key];

    await expect(
      service.upload(Buffer.from('data'), 'paper.pdf', 'application/pdf'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('fails loudly when only some R2 env vars are set', async () => {
    setConfigured();
    delete process.env.R2_PUBLIC_URL;

    await expect(
      service.upload(Buffer.from('data'), 'paper.pdf', 'application/pdf'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('uploads the buffer and returns a public URL built from R2_PUBLIC_URL, preserving the extension', async () => {
    setConfigured();
    sendMock.mockResolvedValue({});

    const url = await service.upload(
      Buffer.from('%PDF-1.4'),
      'SED-24-I Eng+Hin HHHH.pdf',
      'application/pdf',
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(url).toMatch(/^https:\/\/cdn\.example\.com\/past-papers\/[0-9a-f-]+\.pdf$/);
  });

  it('strips a trailing slash from R2_PUBLIC_URL before building the returned URL', async () => {
    setConfigured();
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com/';
    sendMock.mockResolvedValue({});

    const url = await service.upload(Buffer.from('%PDF-1.4'), 'paper.pdf', 'application/pdf');

    expect(url.startsWith('https://cdn.example.com//')).toBe(false);
    expect(url).toMatch(/^https:\/\/cdn\.example\.com\/past-papers\//);
  });

  it('respects a custom folder', async () => {
    setConfigured();
    sendMock.mockResolvedValue({});

    const url = await service.upload(
      Buffer.from('data'),
      'notes.pdf',
      'application/pdf',
      'study-material',
    );

    expect(url).toMatch(/^https:\/\/cdn\.example\.com\/study-material\//);
  });

  it('wraps a failed upload in InternalServerErrorException', async () => {
    setConfigured();
    sendMock.mockRejectedValue(new Error('R2 rejected the request'));

    await expect(
      service.upload(Buffer.from('data'), 'paper.pdf', 'application/pdf'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
