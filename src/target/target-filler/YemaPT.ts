import { getIdByIMDbUrl } from '@/common';
import {
  base64ToBlob,
  filterEmptyTags,
  getTeamName,
} from '@/target/helper/index';
import { BaseFiller } from './base/base-filler';
import { registry, TargetFiller } from './registry';

type YemaPTFormInstance = {
  setFieldsValue?: (fields: Record<string, unknown>) => void;
};

type UploadFile = {
  uid: string;
  name: string;
  size?: number;
  type?: string;
  status?: 'error' | 'done' | 'uploading' | 'removed';
  originFileObj?: File;
};

type TorrentAddPageReadyEventDetail = {
  dispatchCount: number;
  form?: YemaPTFormInstance;
};

type YemaPTOptionValue = string | number;
type YemaPTSelectOptionKey =
  | 'category'
  | 'medium'
  | 'standard'
  | 'codec'
  | 'audiocodec'
  | 'region'
  | 'team'
  | 'tag';

const YEMAPT_SELECT_VALUE_MAP: Record<
  YemaPTSelectOptionKey,
  Record<string, YemaPTOptionValue>
> = {
  category: {
    未分类: 0,
    软件: 3,
    电影: 4,
    剧集: 5,
    短剧: 6,
    音乐: 8,
    广播剧: 9,
    游戏: 10,
    书籍: 12,
    综艺: 13,
    动漫: 14,
    纪录片: 15,
    'MV/演唱会': 16,
    体育: 17,
    其他: 22,
  },
  medium: {
    'Web-DL/WebRip': '1',
    'Blu-ray (1080p Complete)': '2',
    'Blu-ray UHD (4K Complete)': '3',
    Remux: '4',
    'Rip/Encode': '5',
    'HDTV/TV Cap': '6',
    DVDRip: '7',
    DVDrip: '7',
    'Audio CD/Vinyl': '8',
    'DVD (Complete/ISO)': '9',
    Other: '999',
  },
  standard: {
    '720i': '1',
    '720p': '2',
    '1080i': '3',
    '1080p': '4',
    SD: '5',
    '2K/1440p': '6',
    '4K/2160p': '7',
    '8K': '8',
    Other: '999',
  },
  codec: {
    'H.264/AVC': '1',
    'H.265/HEVC': '2',
    'VC-1(Blu-ray)': '3',
    'Bluray(AVC)': '4',
    'Bluray(HEVC)': '5',
    'MPEG-2(Blu-ray/DVD)': '6',
    'Xvid/DivX': '7',
    AV1: '8',
    VP9: '9',
    'H.266/VVC': '10',
    Other: '999',
  },
  audiocodec: {
    AAC: '1',
    'AC3 (Dolby Digital)': '2',
    DTS: '3',
    'DTS-HD MA': '4',
    'E-AC3 (Dolby Digital Plus)': '5',
    'E-AC3 Atmos': '6',
    TrueHD: '7',
    'TrueHD Atmos': '8',
    LPCM: '9',
    FLAC: '10',
    APE: '11',
    MP3: '12',
    OGG: '13',
    Opus: '14',
    Other: '999',
  },
  region: {
    'CN(中国)': '1',
    'HK/CN(香港)': '2',
    'TW/CN(台湾)': '3',
    'US(美国)': '4',
    'EU(欧洲)': '5',
    'JP(日本)': '6',
    'KR(韩国)': '7',
    Other: '999',
  },
  team: {
    OurBits: '1',
    BtsHD: '2',
    BtsTV: '3',
    HDChina: '4',
    CMCT: '5',
    HHWEB: '6',
    FRDS: '7',
    MTeam: '8',
    QHstudio: '9',
    UBits: '10',
    Other: '999',
  },
  tag: {
    禁转: '1',
    首发: '2',
    官组: '3',
    DIY: '4',
    国语: '5',
    中字: '6',
    粤语: '7',
    英字: '8',
    HDR10: '9',
    杜比视界: '10',
    连载中: '11',
    完结: '12',
    多国字幕: '13',
    'HDR10+': '14',
    '杜比全景声(Atmos)': '15',
    'DTS-X': '16',
    '5.1/7.1声道': '17',
    完结全集: '18',
    'SP/剧场版/OVA': '19',
  },
};

export const getYemaPTOptionValue = (
  key: YemaPTSelectOptionKey,
  labelOrValue: YemaPTOptionValue,
): YemaPTOptionValue => {
  const optionMap = YEMAPT_SELECT_VALUE_MAP[key];
  const normalizedValue = String(labelOrValue);

  if (Object.prototype.hasOwnProperty.call(optionMap, normalizedValue)) {
    return optionMap[normalizedValue];
  }

  return labelOrValue;
};

const getYemaPTOptionValues = (
  key: YemaPTSelectOptionKey,
  labelsOrValues: YemaPTOptionValue[],
): YemaPTOptionValue[] =>
  labelsOrValues.map((labelOrValue) => getYemaPTOptionValue(key, labelOrValue));

export const getYemaPTPicture = (
  info: Pick<TorrentInfo.Info, 'poster' | 'description' | 'screenshots'>,
): string => {
  const { poster, description, screenshots = [] } = info;
  if (poster) return poster;

  const firstDescriptionImage =
    description.match(/\[img\]([^[]+?)\[\/img\]/i)?.[1]?.trim() || '';
  if (!firstDescriptionImage) return '';

  const normalizedScreenshots = screenshots.map((screenshot) =>
    screenshot.trim(),
  );
  return normalizedScreenshots.includes(firstDescriptionImage)
    ? ''
    : firstDescriptionImage;
};

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const removeYemaPTScreenshotImages = (
  description: string,
  screenshots: TorrentInfo.Info['screenshots'] = [],
): string => {
  let result = description;
  buildYemaPTScreenshotList(screenshots).forEach((screenshot) => {
    const escapedScreenshot = escapeRegExp(screenshot);
    const wrappedScreenshotImage =
      `\\[url=[^\\]]*?\\][ \\t]*` +
      `\\[img(?:=[^\\]]*?)?\\][ \\t]*${escapedScreenshot}[ \\t]*` +
      `\\[\\/img\\][ \\t]*\\[\\/url\\]`;
    const screenshotImage =
      `\\[img(?:=[^\\]]*?)?\\][ \\t]*${escapedScreenshot}[ \\t]*` +
      `\\[\\/img\\]`;
    result = result
      .replace(
        new RegExp(`^[ \\t]*${wrappedScreenshotImage}[ \\t]*\\n?`, 'gim'),
        '',
      )
      .replace(new RegExp(`^[ \\t]*${screenshotImage}[ \\t]*\\n?`, 'gim'), '')
      .replace(new RegExp(`^[ \\t]*${escapedScreenshot}[ \\t]*\\n?`, 'gim'), '')
      .replace(new RegExp(wrappedScreenshotImage, 'gi'), '')
      .replace(new RegExp(screenshotImage, 'gi'), '');
  });
  return result;
};

export const prepareYemaPTDescription = (
  info: Pick<TorrentInfo.Info, 'description' | 'mediaInfos'> &
    Partial<Pick<TorrentInfo.Info, 'screenshots'>>,
): string => {
  let description = filterEmptyTags(info.description || '').replace(/^\s+/, '');

  info.mediaInfos?.forEach((mediaInfo) => {
    const normalizedMediaInfo =
      typeof mediaInfo === 'string' ? mediaInfo.trim() : '';
    if (!normalizedMediaInfo) return;

    description = description.replace(normalizedMediaInfo, '');
  });

  description = description.replace(
    /\[(mediainfo|bdinfo)\][\s\S]*?\[\/\1\]/gi,
    '',
  );

  description = removeYemaPTScreenshotImages(description, info.screenshots);

  return filterEmptyTags(description).trim();
};

export const buildYemaPTScreenshotList = (
  screenshots: TorrentInfo.Info['screenshots'] = [],
): string[] =>
  screenshots
    .map((screenshot) => screenshot.trim())
    .filter((screenshot) => screenshot.length > 0);

export const getYemaPTSeason = (title: string): number | null => {
  const season =
    title.match(/\bS(?:eason)?\.?\s*0*(\d{1,3})(?:\b|E\d+)/i)?.[1] ||
    title.match(/\bSeason\s+0*(\d{1,3})\b/i)?.[1] ||
    title.match(/第\s*0*(\d{1,3})\s*季/)?.[1];

  if (!season) return null;

  const seasonNumber = parseInt(season, 10);
  return Number.isFinite(seasonNumber) && seasonNumber > 0
    ? seasonNumber
    : null;
};

const convertQuoteToMarkdown = (quote: string, title = ''): string => {
  const normalized = quote.trim();
  if (!normalized) return '';

  const quoteTitle = title.trim() ? `**${title.trim()}**\n` : '';
  return `${quoteTitle}${normalized}`
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
};

const convertFenceToMarkdown = (content: string): string => {
  return `\n\`\`\`text\n${content.trim()}\n\`\`\`\n`;
};

export const bbcodeToMarkdown = (text: string): string => {
  return (text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\[(?:size|font|color)=[^\]]*?\]/gi, '')
    .replace(/\[\/(?:size|font|color)\]/gi, '')
    .replace(/\[(?:left|right|center|align=[^\]]*?)\]/gi, '')
    .replace(/\[\/(?:left|right|center|align)\]/gi, '')
    .replace(/\[hr\]/gi, '\n---\n')
    .replace(/\[img(?:=[^\]]*?)?\]([\s\S]*?)\[\/img\]/gi, (_match, url) => {
      const imageUrl = url.trim();
      return imageUrl ? `![](${imageUrl})` : '';
    })
    .replace(/\[url=([^\]]*?)\]([\s\S]*?)\[\/url\]/gi, (_match, url, label) => {
      const href = url.trim();
      const textLabel = label.trim();
      return textLabel ? `[${textLabel}](${href})` : href;
    })
    .replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_match, url) => {
      const href = url.trim();
      return href ? `[${href}](${href})` : '';
    })
    .replace(/\[(?:b|strong)\]\s*([\s\S]*?)\s*\[\/(?:b|strong)\]/gi, '**$1**')
    .replace(/\[(?:i|em)\]\s*([\s\S]*?)\s*\[\/(?:i|em)\]/gi, '*$1*')
    .replace(/\[s\]\s*([\s\S]*?)\s*\[\/s\]/gi, '~~$1~~')
    .replace(/\[u\]\s*([\s\S]*?)\s*\[\/u\]/gi, '$1')
    .replace(
      /\[(code|pre|mediainfo|bdinfo)\]([\s\S]*?)\[\/\1\]/gi,
      (_match, _tag, code) => convertFenceToMarkdown(code),
    )
    .replace(
      /\[quote=([^\]]*?)\]([\s\S]*?)\[\/quote\]/gi,
      (_match, title, quote) => `${convertQuoteToMarkdown(quote, title)}\n`,
    )
    .replace(
      /\[quote\]([\s\S]*?)\[\/quote\]/gi,
      (_match, quote) => `${convertQuoteToMarkdown(quote)}\n`,
    )
    .replace(
      /\[(?:hide|spoiler|box)(?:=([^\]]*?))?\]([\s\S]*?)\[\/(?:hide|spoiler|box)\]/gi,
      (_match, title, content) => {
        const heading = title?.trim() ? `**${title.trim()}**\n\n` : '';
        return `\n${heading}${content.trim()}\n`;
      },
    )
    .replace(
      /\[comparison(?:=([^\]]*?))?\]([\s\S]*?)\[\/comparison\]/gi,
      (_match, title, content) => {
        const heading = title?.trim() ? `**${title.trim()}**\n\n` : '';
        return `\n${heading}${content.trim()}\n`;
      },
    )
    .replace(/\[list(?:=[^\]]*?)?\]([\s\S]*?)\[\/list\]/gi, (_match, list) =>
      list.replace(/\[\*\]\s*/g, '\n- ').trim(),
    )
    .replace(/^\[\*\]\s*/gm, '- ')
    .replace(/\[\/?\w+(?:=[^\]]*?)?\]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

class YemaPT extends BaseFiller implements TargetFiller {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName === 'YemaPT';
  }

  fill(info: TorrentInfo.Info): void {
    this.info = info;
    window.addEventListener(
      'torrentAddPageReady',
      ((event: CustomEvent<TorrentAddPageReadyEventDetail>) => {
        console.log('YemaPT torrentAddPageReady', event.detail.dispatchCount);
        this.fillYemaPTForm(event.detail.form);
      }) as EventListener,
      { once: true },
    );
  }

  private fillYemaPTForm(form?: YemaPTFormInstance): void {
    const setFieldsValue = form?.setFieldsValue?.bind(form);
    if (!setFieldsValue || !this.info) {
      console.warn('YemaPT form instance was not found');
      return;
    }

    setFieldsValue({
      ...this.buildFields(),
      ...this.buildSelectFields(),
    });
    this.fillTorrentFileByForm(setFieldsValue);
  }

  private buildFields(): Record<string, unknown> {
    const info = this.info!;
    const fields: Record<string, unknown> = {
      showName: info.title,
      shortDesc: info.subtitle || '',
      longDesc: bbcodeToMarkdown(prepareYemaPTDescription(info)),
    };

    const picture = getYemaPTPicture(info);
    if (picture) fields.picture = picture;

    const doubanId = info.doubanUrl?.match(/subject\/(\d+)/)?.[1];
    if (doubanId) fields.douban = doubanId;

    const imdbId = getIdByIMDbUrl(info.imdbUrl || '').replace(/^tt/i, '');
    if (imdbId) fields.imdb = imdbId;

    const mediaInfo = info.mediaInfos?.[0];
    if (mediaInfo) fields.mediaInfo = mediaInfo;

    const screenshotList = buildYemaPTScreenshotList(info.screenshots);
    if (screenshotList.length > 0) fields.screenshotList = screenshotList;

    const season = getYemaPTSeason(info.title);
    if (season) fields.season = season;

    return fields;
  }

  private fillTorrentFileByForm(
    setFieldsValue: (fields: Record<string, unknown>) => void,
  ): void {
    const { torrentData, title } = this.info!;
    if (!torrentData) return;

    const blob = base64ToBlob(torrentData);
    const torrentFileName = title
      .replace(/^\[.*?\](\.| )?/, '')
      .replace(/\s/g, '.');
    const firstFile = new File([blob], `${torrentFileName}.torrent`, {
      type: 'application/x-bittorrent',
    });

    const file: UploadFile = {
      uid: `easy-upload-${firstFile.name}-${firstFile.lastModified}`,
      name: firstFile.name,
      size: firstFile.size,
      type: firstFile.type,
      status: 'done',
      originFileObj: firstFile,
    };
    setFieldsValue({ fileList: [file] });
  }

  private buildSelectFields(): Record<string, unknown> {
    const fields: Record<string, unknown> = {
      medium: getYemaPTOptionValue('medium', this.getVideoType()),
      standard: getYemaPTOptionValue('standard', this.getResolution()),
      codec: getYemaPTOptionValue('codec', this.getVideoCodec()),
      audiocodec: getYemaPTOptionValue('audiocodec', this.getAudioCodec()),
      regionList: getYemaPTOptionValues('region', this.getRegions()),
      team: getYemaPTOptionValue('team', this.getTeam()),
      categoryId: getYemaPTOptionValue('category', this.getCategory()),
    };

    const tags = this.getTags();
    if (tags.length > 0) fields.tagList = getYemaPTOptionValues('tag', tags);

    return fields;
  }

  private getCategory(): string {
    const map = this.siteInfo.category?.map ?? {};
    return (map[this.info!.category] as string) || '未分类';
  }

  private getVideoType(): string {
    const { videoType } = this.info!;
    return (this.siteInfo.videoType?.map?.[videoType] as string) || 'Other';
  }

  private getResolution(): string {
    const { resolution } = this.info!;
    return (this.siteInfo.resolution?.map?.[resolution] as string) || 'Other';
  }

  private getVideoCodec(): string {
    const { videoCodec = '', videoType } = this.info!;
    if (
      /^(h264|x264)$/i.test(videoCodec) &&
      /^(bluray|uhdbluray)$/i.test(videoType)
    ) {
      return 'Bluray(AVC)';
    }
    if (
      /^(hevc|h265|x265)$/i.test(videoCodec) &&
      /^(bluray|uhdbluray)$/i.test(videoType)
    ) {
      return 'Bluray(HEVC)';
    }
    return (this.siteInfo.videoCodec?.map?.[videoCodec] as string) || 'Other';
  }

  private getAudioCodec(): string {
    const { audioCodec = '', title } = this.info!;
    if (/^(atmos)$/i.test(audioCodec)) {
      return /DDP|DD\+|E-?AC-?3/i.test(title) ? 'E-AC3 Atmos' : 'TrueHD Atmos';
    }
    if (/^truehd$/i.test(audioCodec) && /Atmos/i.test(title)) {
      return 'TrueHD Atmos';
    }
    if (/^(ac3|dd|dd\+)$/i.test(audioCodec) && /DDP|DD\+/i.test(title)) {
      return /Atmos/i.test(title)
        ? 'E-AC3 Atmos'
        : 'E-AC3 (Dolby Digital Plus)';
    }
    return (this.siteInfo.audioCodec?.map?.[audioCodec] as string) || 'Other';
  }

  private getRegions(): string[] {
    const area = this.info!.area;
    const areaMap: Record<string, string> = {
      CN: 'CN(中国)',
      HK: 'HK/CN(香港)',
      TW: 'TW/CN(台湾)',
      JP: 'JP(日本)',
      KR: 'KR(韩国)',
      US: 'US(美国)',
      EU: 'EU(欧洲)',
    };

    return area && areaMap[area] ? [areaMap[area]] : ['Other'];
  }

  private getTeam(): string {
    const teamName = getTeamName(this.info!.title)?.toLowerCase();
    if (!teamName) return 'Other';
    return (this.siteInfo.team?.map?.[teamName] as string) || 'Other';
  }

  private getTags(): string[] {
    const { tags, title } = this.info!;
    const result: string[] = [];
    if (tags.chinese_audio) result.push('国语');
    if (tags.chinese_subtitle) result.push('中字');
    if (tags.cantonese_audio) result.push('粤语');
    if (tags.hdr10) result.push('HDR10');
    if (tags.hdr10_plus) result.push('HDR10+');
    if (tags.dolby_vision) result.push('杜比视界');
    if (tags.dolby_atmos) result.push('杜比全景声(Atmos)');
    if (tags.dts_x) result.push('DTS-X');
    if (tags.diy) result.push('DIY');
    if (tags.exclusive) result.push('首发');
    if (/E\d+/i.test(title)) result.push('连载中');
    if (/complete|S\d{2}(?!E\d{2})/i.test(title)) result.push('完结');
    return result;
  }
}

registry.register(new YemaPT());
