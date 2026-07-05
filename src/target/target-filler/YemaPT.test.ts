import { describe, expect, it } from 'vitest';
import {
  bbcodeToMarkdown,
  getYemaPTCategory,
  getYemaPTSeason,
  isYemaPTOptionMatch,
  prepareYemaPTDescription,
} from './YemaPT';

describe('YemaPT target filler helpers', () => {
  it('converts common BBCode tags to Markdown', () => {
    const bbcode = [
      '[size=12][color=red][b]标题[/b][/color][/size]',
      '[img]https://example.com/a.jpg[/img]',
      '[img=350x350]https://example.com/b.jpg[/img]',
      '[url=https://example.com]站点[/url]',
      '[quote=发布组]第一行\n第二行[/quote]',
      '[list][*]A[*]B[/list]',
      '[hide=截图][comparison=Source / Encode][img]https://example.com/c.png[/img][/comparison][/hide]',
    ].join('\n');

    expect(bbcodeToMarkdown(bbcode)).toBe(
      [
        '**标题**',
        '![](https://example.com/a.jpg)',
        '![](https://example.com/b.jpg)',
        '[站点](https://example.com)',
        '> **发布组**',
        '> 第一行',
        '> 第二行',
        '',
        '- A',
        '- B',
        '',
        '**截图**',
        '',
        '**Source / Encode**',
        '',
        '![](https://example.com/c.png)',
      ].join('\n'),
    );
  });

  it('keeps code-like blocks as fenced Markdown', () => {
    expect(bbcodeToMarkdown('[mediainfo]General\nUnique ID[/mediainfo]')).toBe(
      '```text\nGeneral\nUnique ID\n```',
    );
  });

  it('removes media info from long description before conversion', () => {
    const mediaInfo = 'General\nComplete name: demo.mkv';
    expect(
      prepareYemaPTDescription({
        description: `简介\n[quote]${mediaInfo}[/quote]\n[mediainfo]${mediaInfo}[/mediainfo]`,
        mediaInfos: [mediaInfo],
      }),
    ).toBe('简介');
  });

  it('ignores null media info entries when cleaning description', () => {
    const mediaInfo = 'General\nComplete name: demo.mkv';
    const malformedInfo = {
      description: `简介\n[quote]${mediaInfo}[/quote]`,
      mediaInfos: [null, undefined, '   ', mediaInfo],
    } as unknown as Parameters<typeof prepareYemaPTDescription>[0];

    expect(prepareYemaPTDescription(malformedInfo)).toBe('简介');
  });

  it('gets season number from common torrent title patterns', () => {
    expect(getYemaPTSeason('Show.Name.S02E03.1080p.WEB-DL')).toBe(2);
    expect(getYemaPTSeason('Show Name Season 03 2160p WEB-DL')).toBe(3);
    expect(getYemaPTSeason('剧名 第4季 1080p WEB-DL')).toBe(4);
    expect(getYemaPTSeason('Movie.Name.2024.1080p.BluRay')).toBeNull();
  });

  it('maps HH movie category to YemaPT category value', () => {
    expect(getYemaPTCategory('movie', { movie: 4 })).toBe(4);
    expect(getYemaPTCategory('unknown', { movie: 4 })).toBe(0);
  });

  it('maps extended YemaPT category values', () => {
    const categoryMap = {
      app: 3,
      game: 10,
      ebook: 12,
      music: 8,
      audiobook: 9,
      onlineCourse: 21,
      other: 22,
    };

    expect(getYemaPTCategory('app', categoryMap)).toBe(3);
    expect(getYemaPTCategory('game', categoryMap)).toBe(10);
    expect(getYemaPTCategory('ebook', categoryMap)).toBe(12);
    expect(getYemaPTCategory('music', categoryMap)).toBe(8);
    expect(getYemaPTCategory('audiobook', categoryMap)).toBe(9);
    expect(getYemaPTCategory('onlineCourse', categoryMap)).toBe(21);
    expect(getYemaPTCategory('other', categoryMap)).toBe(22);
  });

  it('matches YemaPT dropdown options by title or visible text', () => {
    expect(isYemaPTOptionMatch('电影', '', '电影')).toBe(true);
    expect(isYemaPTOptionMatch('', '电影 / Movies', '电影')).toBe(true);
    expect(isYemaPTOptionMatch('Movies', '电影', '电影')).toBe(true);
    expect(isYemaPTOptionMatch('剧集', '剧集', '电影')).toBe(false);
  });
});
