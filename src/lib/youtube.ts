import { google } from "googleapis";

const youtube = google.youtube("v3");

export interface YouTubeComment {
  id: string;
  userId: string;
  userName: string;
  userProfilePic: string;
  text: string;
  publishedAt: string;
}

export async function fetchLatestComments(
  videoId: string,
  apiKey: string,
  maxResults = 50
): Promise<YouTubeComment[]> {
  try {
    const response = await youtube.commentThreads.list({
      key: apiKey,
      part: ["snippet"],
      videoId: videoId,
      maxResults: maxResults,
      order: "time",
    });

    const items = response.data.items || [];
    return items.map((item) => {
      const snippet = item.snippet?.topLevelComment?.snippet;
      return {
        id: item.snippet?.topLevelComment?.id || "",
        userId: snippet?.authorChannelId?.value || "",
        userName: snippet?.authorDisplayName || "Anonymous",
        userProfilePic: snippet?.authorProfileImageUrl || "",
        text: snippet?.textDisplay || "",
        publishedAt: snippet?.publishedAt || new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error("Error fetching YouTube comments:", error);
    // For demo purposes/no API key, we could return mock data here if needed
    // return getMockComments();
    throw error;
  }
}

export interface VideoMetadata {
  title: string;
  viewCount: string;
  likeCount: string;
}

export async function fetchVideoMetadata(
  videoId: string,
  apiKey: string
): Promise<VideoMetadata | null> {
  try {
    const response = await youtube.videos.list({
      key: apiKey,
      part: ["snippet", "statistics"],
      id: [videoId],
    });

    const item = response.data.items?.[0];
    if (!item) return null;

    return {
      title: item.snippet?.title || "Unknown Title",
      viewCount: item.statistics?.viewCount || "0",
      likeCount: item.statistics?.likeCount || "0",
    };
  } catch (error) {
    console.error("Error fetching video metadata:", error);
    return null;
  }
}

// Mock helper for development
export function getMockComments(count = 5): YouTubeComment[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `mock-id-${Date.now()}-${i}`,
    userId: `user-${i}`,
    userName: `User ${i}`,
    userProfilePic: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
    text: i % 2 === 0 ? `This is a valid comment number ${i} with enough words.` : `bad ${i}`,
    publishedAt: new Date(Date.now() - i * 60000).toISOString(),
  }));
}
