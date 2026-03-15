import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractVideoId } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    
    if (authHeader !== adminPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      videoId: inputVideoId, baseTimer, prolongTime, silencePeriod, 
      minWords, minChars, minSentences, antiSpamConfig,
      lastNCount, firstNCount, prizeMain, prizeLastN, prizeFirstN
    } = body;

    const videoId = extractVideoId(inputVideoId);
    if (!videoId || videoId.length !== 11) {
      return NextResponse.json({ error: "Invalid YouTube Video ID" }, { status: 400 });
    }

    // Fetch video metadata to save it in DB
    const apiKey = process.env.YOUTUBE_API_KEY;
    let videoTitle = "Unknown Title";
    let viewCount = "0";
    let likeCount = "0";

    if (apiKey) {
      const { fetchVideoMetadata } = await import("@/lib/youtube");
      const metadata = await fetchVideoMetadata(videoId, apiKey);
      if (metadata) {
        videoTitle = metadata.title;
        viewCount = metadata.viewCount;
        likeCount = metadata.likeCount;
      }
    } else {
      videoTitle = "Demo Video Title";
    }

    const game = await prisma.game.create({
      data: {
        videoId,
        videoTitle,
        viewCount,
        likeCount,
        baseTimer: Math.max(10, parseInt(baseTimer) || 300),
        prolongTime: Math.max(0, parseInt(prolongTime) || 60),
        silencePeriod: Math.max(5, parseInt(silencePeriod) || 300),
        minWords: Math.max(0, parseInt(minWords) || 0),
        minChars: Math.max(0, parseInt(minChars) || 0),
        minSentences: Math.max(0, parseInt(minSentences) || 0),
        antiSpamConfig: Math.max(0, parseInt(antiSpamConfig) || 0),
        lastNCount: Math.max(1, parseInt(lastNCount) || 3),
        firstNCount: Math.max(1, parseInt(firstNCount) || 10),
        prizeMain: prizeMain || null,
        prizeLastN: prizeLastN || null,
        prizeFirstN: prizeFirstN || null,
        status: "WAITING",
      },
    });

    return NextResponse.json(game);
  } catch (error) {
    console.error("Failed to create game:", error);
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const games = await prisma.game.findMany({
      orderBy: { createdAt: "desc" },
      include: { winners: true },
    });
    return NextResponse.json(games);
  } catch (error) {
    console.error("API GET ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}
