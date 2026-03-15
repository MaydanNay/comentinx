// Helper to extract Video ID from various YouTube URL formats
export function extractVideoId(input: string): string {
  const regex = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
  const match = input.match(regex);
  return (match && match[1].length === 11) ? match[1] : input;
}
