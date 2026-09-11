import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, StudyMaterial } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicStudyMaterialsService } from './public-study-materials.service.js';

describe('PublicStudyMaterialsService', () => {
  let service: PublicStudyMaterialsService;
  const prismaMock = {
    studyMaterial: {
      findMany: vi.fn<(args: Prisma.StudyMaterialFindManyArgs) => Promise<StudyMaterial[]>>(),
      count: vi.fn<(args: Prisma.StudyMaterialCountArgs) => Promise<number>>(),
      findUnique:
        vi.fn<(args: Prisma.StudyMaterialFindUniqueArgs) => Promise<StudyMaterial | null>>(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicStudyMaterialsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<PublicStudyMaterialsService>(PublicStudyMaterialsService);
  });

  it('findAll paginates using skip/take derived from page/pageSize, ordered by subject then title', async () => {
    prismaMock.studyMaterial.findMany.mockResolvedValue([{ id: '1' } as StudyMaterial]);
    prismaMock.studyMaterial.count.mockResolvedValue(45);

    const result = await service.findAll({ page: 3, pageSize: 10 });

    expect(prismaMock.studyMaterial.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ subject: 'asc' }, { title: 'asc' }],
      skip: 20,
      take: 10,
    });
    expect(result).toEqual({
      data: [{ id: '1' }],
      page: 3,
      pageSize: 10,
      total: 45,
      totalPages: 5,
    });
  });

  it('findAll adds subject to the where clause when provided (no examBoardId field exists)', async () => {
    prismaMock.studyMaterial.findMany.mockResolvedValue([]);
    prismaMock.studyMaterial.count.mockResolvedValue(0);

    await service.findAll({ page: 1, pageSize: 20, subject: 'Chemistry' });

    const where = prismaMock.studyMaterial.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ subject: 'Chemistry' });
  });

  it('findOne returns null (not a throw) when not found, letting the controller 404', async () => {
    prismaMock.studyMaterial.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).resolves.toBeNull();
  });
});
