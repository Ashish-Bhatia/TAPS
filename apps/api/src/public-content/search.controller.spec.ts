import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

describe('SearchController', () => {
  let controller: SearchController;
  const serviceMock = { search: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: serviceMock }],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  it('delegates the query straight through to the service (no guard, no auth)', async () => {
    const page = { data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    serviceMock.search.mockResolvedValue(page);
    const query = { q: 'delhi', page: 1, pageSize: 20 };

    await expect(controller.search(query)).resolves.toEqual(page);
    expect(serviceMock.search).toHaveBeenCalledWith(query);
  });
});
