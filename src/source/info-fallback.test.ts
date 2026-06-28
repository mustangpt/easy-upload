import { describe, expect, it } from 'vitest';
import { applyExternalIdFallbacks } from './info-fallback';

const buildInfo = (info: Partial<TorrentInfo.Info>): TorrentInfo.Info =>
  ({
    title: '',
    description: '',
    doubanInfo: '',
    doubanUrl: '',
    imdbUrl: '',
    screenshots: [],
    tags: {},
    mediaInfos: [],
    ...info,
  }) as TorrentInfo.Info;

describe('source external id fallbacks', () => {
  it('fills missing douban and imdb URLs from description', () => {
    const info = applyExternalIdFallbacks(
      buildInfo({
        description:
          '◎IMDb链接 https://www.imdb.com/title/tt11630814/\n◎豆瓣链接 [url=https://movie.douban.com/subject/34951007/]豆瓣[/url]',
      }),
    );

    expect(info.doubanUrl).toBe('https://movie.douban.com/subject/34951007/');
    expect(info.imdbUrl).toBe('https://www.imdb.com/title/tt11630814/');
  });

  it('fills missing IDs from doubanInfo', () => {
    const info = applyExternalIdFallbacks(
      buildInfo({
        doubanInfo:
          '◎IMDb链接 tt7654321\n◎豆瓣链接 https://book.douban.com/subject/123456/',
      }),
    );

    expect(info.doubanUrl).toBe('https://book.douban.com/subject/123456/');
    expect(info.imdbUrl).toBe('https://www.imdb.com/title/tt7654321/');
  });

  it('keeps existing source URLs', () => {
    const info = applyExternalIdFallbacks(
      buildInfo({
        doubanUrl: 'https://movie.douban.com/subject/111111/',
        imdbUrl: 'https://www.imdb.com/title/tt1111111/',
        description:
          'https://movie.douban.com/subject/222222/ https://www.imdb.com/title/tt2222222/',
      }),
    );

    expect(info.doubanUrl).toBe('https://movie.douban.com/subject/111111/');
    expect(info.imdbUrl).toBe('https://www.imdb.com/title/tt1111111/');
  });
});
