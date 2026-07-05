import { getIdByIMDbUrl } from '@/common';
import {
  base64ToBlob,
  filterEmptyTags,
  getTeamName,
} from '@/target/helper/index';
import { BaseFiller } from './base/base-filler';
import { registry, TargetFiller } from './registry';

type ReactFiberNode = {
  child?: ReactFiberNode;
  sibling?: ReactFiberNode;
  stateNode?: {
    state?: unknown;
    context?: {
      setFieldsValue?: (fields: Record<string, unknown>) => void;
    };
  };
};

type ReactComponentInstance = NonNullable<ReactFiberNode['stateNode']>;

export const prepareYemaPTDescription = (
  info: Pick<TorrentInfo.Info, 'description' | 'mediaInfos'>,
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

  return filterEmptyTags(description).trim();
};

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

export const getYemaPTCategory = (
  category: string,
  categoryMap: Record<string, unknown> = {},
): unknown => {
  return categoryMap[category] ?? 0;
};

export const getYemaPTMappedOption = (
  key: string | undefined,
  optionMap: Record<string, unknown> = {},
  fallback: string = '999',
): string => {
  if (!key) return fallback;

  const option = optionMap[key];
  return typeof option === 'string' ? option : fallback;
};

export const getYemaPTMappedOptions = (
  keys: string[],
  optionMap: Record<string, unknown> = {},
): string[] => {
  return keys
    .map((key) => optionMap[key])
    .filter((option): option is string => typeof option === 'string');
};

export const isYemaPTOptionMatch = (
  optionTitle: string,
  optionText: string,
  targetTitle: string,
): boolean => {
  const target = targetTitle.trim();
  const title = optionTitle.trim();
  const text = optionText.trim();

  if (!target) return false;
  if (title === target || text === target) return true;
  return title.includes(target) || text.includes(target);
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
      () => {
        this.fillYemaPTForm();
      },
      { once: true },
    );
  }

  private fillYemaPTForm(): void {
    const instance = this.getAntFormInstance();
    const setFieldsValue = instance?.context?.setFieldsValue;
    if (!setFieldsValue || !this.info) {
      console.warn('YemaPT form instance was not found');
      return;
    }

    const fields = this.buildFields();
    setFieldsValue.call(instance.context, fields);
    this.fillTorrentFileByForm(setFieldsValue.bind(instance.context));
  }

  private getAntFormInstance() {
    const antForm = document.querySelector('#torrent-add-form, form.ant-form');
    if (!antForm) return null;

    const fiber = this.getReactFiberNode(antForm);
    return this.getReactComponentInstance(fiber);
  }

  private getReactFiberNode(element: Element): ReactFiberNode | null {
    for (const key in element) {
      if (key.startsWith('__reactFiber')) {
        return (element as unknown as Record<string, ReactFiberNode>)[key];
      }
    }
    return null;
  }

  private getReactComponentInstance(
    fiberNode: ReactFiberNode | null,
  ): ReactComponentInstance | null {
    if (fiberNode?.stateNode?.state !== undefined) {
      return fiberNode.stateNode;
    }

    let child = fiberNode?.child;
    while (child) {
      const instance: ReactComponentInstance | null =
        this.getReactComponentInstance(child);
      if (instance) return instance;
      child = child.sibling;
    }

    return null;
  }

  private buildFields(): Record<string, unknown> {
    const info = this.info!;
    const fields: Record<string, unknown> = {
      showName: info.title,
      shortDesc: info.subtitle || '',
      longDesc: bbcodeToMarkdown(prepareYemaPTDescription(info)),
    };

    const picture = this.getPoster();
    if (picture) fields.picture = picture;

    const doubanId = info.doubanUrl?.match(/subject\/(\d+)/)?.[1];
    if (doubanId) fields.douban = doubanId;

    const imdbId = getIdByIMDbUrl(info.imdbUrl || '').replace(/^tt/i, '');
    if (imdbId) fields.imdb = imdbId;

    const mediaInfo = info.mediaInfos?.[0];
    if (mediaInfo) fields.mediaInfo = mediaInfo;

    const season = getYemaPTSeason(info.title);
    if (season) fields.season = season;

    fields.categoryId = this.getCategory();
    fields.medium = this.getVideoType();
    fields.standard = this.getResolution();
    fields.codec = this.getVideoCodec();
    fields.audiocodec = this.getAudioCodec();
    fields.regionList = this.getRegions();
    fields.team = this.getTeam();
    fields.tagList = this.getTags();

    return fields;
  }

  private getPoster(): string {
    const { poster, description } = this.info!;
    if (poster) return poster;
    return description.match(/\[img\]([^[]+?)\[\/img\]/i)?.[1]?.trim() || '';
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
    const file = new File([blob], `${torrentFileName}.torrent`, {
      type: 'application/x-bittorrent',
    }) as File & { originFileObj?: File };

    file.originFileObj = file;
    setFieldsValue({ fileList: [file] });
  }

  private getCategory(): unknown {
    const map = this.siteInfo.category?.map ?? {};
    return getYemaPTCategory(this.info!.category, map);
  }

  private getVideoType(): string {
    const { videoType } = this.info!;
    return getYemaPTMappedOption(videoType, this.siteInfo.videoType?.map);
  }

  private getResolution(): string {
    const { resolution } = this.info!;
    return getYemaPTMappedOption(resolution, this.siteInfo.resolution?.map);
  }

  private getVideoCodec(): string {
    const { videoCodec = '', videoType } = this.info!;
    if (
      /^(h264|x264)$/i.test(videoCodec) &&
      /^(bluray|uhdbluray)$/i.test(videoType)
    ) {
      return getYemaPTMappedOption('blurayAvc', this.siteInfo.videoCodec?.map);
    }
    if (
      /^(hevc|h265|x265)$/i.test(videoCodec) &&
      /^(bluray|uhdbluray)$/i.test(videoType)
    ) {
      return getYemaPTMappedOption('blurayHevc', this.siteInfo.videoCodec?.map);
    }
    return getYemaPTMappedOption(videoCodec, this.siteInfo.videoCodec?.map);
  }

  private getAudioCodec(): string {
    const { audioCodec = '', title } = this.info!;
    if (/^(atmos)$/i.test(audioCodec)) {
      return /DDP|DD\+|E-?AC-?3/i.test(title)
        ? getYemaPTMappedOption('eac3Atmos', this.siteInfo.audioCodec?.map)
        : getYemaPTMappedOption('truehdAtmos', this.siteInfo.audioCodec?.map);
    }
    if (/^truehd$/i.test(audioCodec) && /Atmos/i.test(title)) {
      return getYemaPTMappedOption(
        'truehdAtmos',
        this.siteInfo.audioCodec?.map,
      );
    }
    if (/^(ac3|dd|dd\+)$/i.test(audioCodec) && /DDP|DD\+/i.test(title)) {
      return /Atmos/i.test(title)
        ? getYemaPTMappedOption('eac3Atmos', this.siteInfo.audioCodec?.map)
        : getYemaPTMappedOption('dd+', this.siteInfo.audioCodec?.map);
    }
    return getYemaPTMappedOption(audioCodec, this.siteInfo.audioCodec?.map);
  }

  private getRegions(): string[] {
    const area = this.info!.area;
    const regionMap = this.siteInfo.region?.map ?? {};
    return [getYemaPTMappedOption(area, regionMap)];
  }

  private getTeam(): string {
    const teamName = getTeamName(this.info!.title)?.toLowerCase();
    return getYemaPTMappedOption(teamName, this.siteInfo.team?.map);
  }

  private getTags(): string[] {
    const { tags, title } = this.info!;
    const tagKeys: string[] = [];
    if (tags.chinese_audio) tagKeys.push('chinese_audio');
    if (tags.chinese_subtitle) tagKeys.push('chinese_subtitle');
    if (tags.cantonese_audio) tagKeys.push('cantonese_audio');
    if (tags.hdr10) tagKeys.push('hdr10');
    if (tags.hdr10_plus) tagKeys.push('hdr10_plus');
    if (tags.dolby_vision) tagKeys.push('dolby_vision');
    if (tags.dolby_atmos) tagKeys.push('dolby_atmos');
    if (tags.dts_x) tagKeys.push('dts_x');
    if (tags.diy) tagKeys.push('diy');
    if (tags.exclusive) tagKeys.push('exclusive');
    if (/E\d+/i.test(title)) tagKeys.push('serializing');
    if (/complete|S\d{2}(?!E\d{2})/i.test(title)) tagKeys.push('completed');
    return getYemaPTMappedOptions(tagKeys, this.siteInfo.tags);
  }
}

registry.register(new YemaPT());
