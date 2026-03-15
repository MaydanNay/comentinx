import { NextResponse } from "next/server";
import { fetchVideoMetadata } from "@/lib/youtube";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  if (!apiKey) {
    // Return mock data if no API key
    return NextResponse.json({
      title: "Пример названия видео (Demo Mode)",
      viewCount: "123456",
      likeCount: "7890"
    });
  }

  const metadata = await fetchVideoMetadata(videoId, apiKey);
  if (!metadata) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json(metadata);
}
