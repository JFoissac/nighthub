import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TrumpNewsService } from './trump-news.service';

describe('TrumpNewsService', () => {
  let service: TrumpNewsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TrumpNewsService],
    });
    service = TestBed.inject(TrumpNewsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch trump news with the given limit', () => {
    const fakeNews = [{ id: '1', title: 'Tirs contre Trump', isBreaking: true }];

    service.getTrumpNews(8).subscribe((items) => {
      expect(items).toEqual(fakeNews as any);
    });

    const req = httpMock.expectOne('http://localhost:3001/api/trump/news?limit=8');
    expect(req.request.method).toBe('GET');
    req.flush(fakeNews);
  });

  it('returns an empty array on HTTP error', () => {
    service.getTrumpNews(5).subscribe((items) => {
      expect(items).toEqual([]);
    });

    const req = httpMock.expectOne('http://localhost:3001/api/trump/news?limit=5');
    req.flush('boom', { status: 500, statusText: 'Server Error' });
  });
});
