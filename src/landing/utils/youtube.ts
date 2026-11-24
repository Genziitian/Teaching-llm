/**
 * Extracts the 11-character YouTube video ID from various YouTube URL formats.
 * E.g., normal links, share links, embed links, or raw IDs.
 */
export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  
  // If it's already just an 11-character ID
  const trimmed = url.trim();
  if (trimmed.length === 11 && !trimmed.includes('/') && !trimmed.includes('.') && !trimmed.includes('?')) {
    return trimmed;
  }
  
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}
