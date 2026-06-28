const getDoubanUrlFromText = (text: string): string => {
  const match = text.match(
    /https?:\/\/((?:movie|book)\.)?douban\.com\/subject\/(\d+)/i,
  );
  if (!match) return '';

  const host = match[1] === 'book.' ? 'book.douban.com' : 'movie.douban.com';
  return `https://${host}/subject/${match[2]}/`;
};

const getIMDbUrlFromText = (text: string): string => {
  const id =
    text.match(/https?:\/\/(?:www\.)?imdb\.com\/title\/(tt\d{5,13})/i)?.[1] ||
    text.match(/\b(tt\d{5,13})\b/i)?.[1] ||
    '';

  return id ? `https://www.imdb.com/title/${id.toLowerCase()}/` : '';
};

export const applyExternalIdFallbacks = (
  info: TorrentInfo.Info,
): TorrentInfo.Info => {
  const text = `${info.description || ''}\n${info.doubanInfo || ''}`;

  if (!info.doubanUrl) {
    info.doubanUrl = getDoubanUrlFromText(text);
  }

  if (!info.imdbUrl) {
    info.imdbUrl = getIMDbUrlFromText(text);
  }

  return info;
};
