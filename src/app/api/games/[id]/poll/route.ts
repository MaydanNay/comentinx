import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLatestComments, getMockComments } from "@/lib/youtube";
import { processNewComments, checkGameEnd } from "@/lib/gameManager";
import { getFromCache, setToCache } from "@/lib/cache";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

    // Use Cache for YouTube results to save quota (Point 1 in Max Optimization)
    const cacheKey = `yt-comments-${game.videoId}`;
    let comments = getFromCache<any[]>(cacheKey);

    if (!comments) {
        if (process.env.YOUTUBE_API_KEY) {
            comments = await fetchLatestComments(game.videoId, process.env.YOUTUBE_API_KEY);
        } else {
            comments = getMockComments(3);
        }
        setToCache(cacheKey, comments, 3); // 3-second cache
    }

    console.time(`poll-${id}`);
    if (comments && comments.length > 0) {
        await processNewComments(id, comments);
    }
    await checkGameEnd(id);
    console.timeEnd(`poll-${id}`);

    const updatedGame = await prisma.game.findUnique({
      where: { id },
      include: { 
        comments: { orderBy: { timestamp: "desc" }, take: 50 },
        winners: true,
        _count: { select: { comments: { where: { status: "VALID" } } } }
      }
    });

    if (!updatedGame) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Calculate actual time left for the frontend
    let timeLeft = null;
    if (updatedGame.status === "FINISHED") {
        timeLeft = 0;
    } else if (updatedGame.status === "WAITING") {
        timeLeft = updatedGame.baseTimer;
    } else if (updatedGame.status === "ACTIVE" && updatedGame.startTime && updatedGame.lastCommentAt) {
        const now = Date.now();
        const silenceEnd = new Date(updatedGame.lastCommentAt).getTime() + (updatedGame.silencePeriod * 1000);
        const validCount = updatedGame._count.comments;
        const totalAllocatedMs = (updatedGame.baseTimer * 1000) + (Math.max(0, validCount - 1) * updatedGame.prolongTime * 1000);
        const absoluteEnd = new Date(updatedGame.startTime).getTime() + totalAllocatedMs;
        
        timeLeft = Math.max(0, Math.floor((Math.min(silenceEnd, absoluteEnd) - now) / 1000));
    }

    return NextResponse.json({ ...updatedGame, timeLeft });
  } catch (error) {
    console.error("Poll error:", error);
    return NextResponse.json({ error: "Polling failed" }, { status: 500 });
  }
}
