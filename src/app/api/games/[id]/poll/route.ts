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

    // Optimization: Only one client triggers the heavy sync logic every 10s
    // Also, don't sync if the game is already finished
    const lastSyncKey = `last-sync-${id}`;
    const needsSync = !getFromCache<boolean>(lastSyncKey) && game.status !== "FINISHED";

    if (needsSync) {
        // Set lock immediately for 10 seconds
        setToCache(lastSyncKey, true, 10);

        try {
            const cacheKey = `yt-comments-${game.videoId}`;
            let comments = getFromCache<any[]>(cacheKey);

            if (!comments) {
                if (process.env.YOUTUBE_API_KEY) {
                    comments = await fetchLatestComments(game.videoId, process.env.YOUTUBE_API_KEY);
                } else {
                    comments = getMockComments(3);
                }
                setToCache(cacheKey, comments, 3); // 3-second internal cache
            }

            if (comments && comments.length > 0) {
                await processNewComments(id, comments);
            }
            await checkGameEnd(id);
        } catch (syncError) {
            console.error("Background sync failed but continuing for spectator:", syncError);
            // We ignore the error so the spectator still gets the last known state from DB
        }
    }

    const updatedGame = await prisma.game.findUnique({
      where: { id },
      include: { 
        comments: { orderBy: { timestamp: "desc" }, take: 50 },
        winners: true,
        _count: { select: { comments: { where: { status: "VALID" } } } }
      }
    });

    if (!updatedGame) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Use the pre-calculated unique participants count from the DB (Optimization for 1000+ users)
    const uniqueParticipantsCount = (updatedGame as any).uniqueParticipantsCount;

    // Calculate actual time left for the frontend
    let timeLeft = null;
    let endTime = null;

    if (updatedGame.status === "FINISHED") {
        timeLeft = 0;
        endTime = Date.now();
    } else if (updatedGame.status === "WAITING") {
        timeLeft = updatedGame.baseTimer;
        // In WAITING, we don't have an endTime yet as it starts from the first comment
    } else if (updatedGame.status === "ACTIVE" && updatedGame.startTime && updatedGame.lastCommentAt) {
        const now = Date.now();
        const silenceEnd = new Date(updatedGame.lastCommentAt).getTime() + (updatedGame.silencePeriod * 1000);
        const validCount = updatedGame._count.comments;
        const totalAllocatedMs = (updatedGame.baseTimer * 1000) + (Math.max(0, validCount - 1) * updatedGame.prolongTime * 1000);
        const absoluteEnd = new Date(updatedGame.startTime).getTime() + totalAllocatedMs;
        
        endTime = Math.max(silenceEnd, absoluteEnd);
        timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
    }

    const bonusTime = updatedGame.status !== "WAITING" 
        ? Math.max(0, updatedGame._count.comments - 1) * updatedGame.prolongTime 
        : 0;

    return NextResponse.json({ ...updatedGame, timeLeft, endTime, bonusTime, uniqueParticipantsCount, serverTime: Date.now() });
  } catch (error) {
    console.error("Poll error:", error);
    return NextResponse.json({ error: "Polling failed" }, { status: 500 });
  }
}
