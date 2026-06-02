/**
 * Converts standard video URLs (YouTube, Google Drive) to their embeddable versions.
 */
export function getEmbedUrl(url: string): string {
  if (!url) return '';

  // YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch && youtubeMatch[1]) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?modestbranding=1&rel=0&showinfo=0&controls=1&iv_load_policy=3&disablekb=1&fs=0`;
  }

  // Google Drive
  const driveRegex = /(?:drive\.google\.com\/(?:file\/d\/|uc\?id=)|googledrive\.com\/host\/)([^\/\?&]+)/i;
  const driveMatch = url.match(driveRegex);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  // Vimeo
  const vimeoRegex = /vimeo\.com\/(\d+)/i;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return url;
}

/**
 * Attempts to get a direct video file URL for services that support it.
 */
export function getDirectVideoUrl(url: string): string | null {
  if (!url) return null;

  // We intentionally do NOT return a direct download link for Google Drive,
  // because large files prompt a virus scan HTML page, causing video playback errors.
  // Returning null forces the VideoPlayer to use the embeddable iframe /preview.

  // If it's already a direct file link
  if (url.match(/\.(mp4|webm|ogg)$/i)) {
    return url;
  }

  return null;
}

/**
 * Converts document URLs to their embeddable versions.
 */
export function getDocumentEmbedUrl(url: string): string | null {
  if (!url) return null;

  // Google Drive (Docs, Sheets, Slides, PDF)
  const driveRegex = /(?:drive\.google\.com\/(?:file\/d\/|uc\?id=)|googledrive\.com\/host\/)([^\/\?&]+)/i;
  const driveMatch = url.match(driveRegex);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  // Google Slides (published)
  if (url.includes('docs.google.com/presentation') && url.includes('/pub')) {
    return url.replace('/pub', '/embed');
  }

  // Google Sheets (published)
  if (url.includes('docs.google.com/spreadsheets') && url.includes('/pubhtml')) {
    return url; // pubhtml is already embeddable
  }

  return null;
}

export const getPreviewUrl = (url: string) => {
  if (!url) return '';
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
       return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  }
  if (url.includes('imgur.com/') && !url.includes('i.imgur.com/') && !url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    const id = url.split('/').pop()?.split('?')[0];
    if (id) return `https://i.imgur.com/${id}.png`;
  }
  return url;
};
