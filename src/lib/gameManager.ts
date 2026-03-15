import { prisma } from "./prisma";
import { validateComment, ValidationRules } from "./validation";
import { YouTubeComment } from "./youtube";

export async function processNewComments(gameId: string, youtubeComments: YouTubeComment[]) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });

  if (!game || game.status === "FINISHED") return;

  const rules: ValidationRules = {
    minWords: game.minWords,
    minChars: game.minChars,
    minSentences: game.minSentences,
    antiSpamMinutes: game.antiSpamConfig,
  };

  // 1. Filter out comments we already have in a single query
  const commentIds = youtubeComments.map(c => c.id);
  const existingComments = await prisma.comment.findMany({
    where: { commentId: { in: commentIds } },
    select: { commentId: true }
  });
  const existingIds = new Set(existingComments.map(c => c.commentId));
  const newComments = youtubeComments.filter(c => !existingIds.has(c.id));

  if (newComments.length === 0) return;

  // 2. Sort new comments by time
  const sortedComments = newComments.sort((a, b) => {
    const timeDiff = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });

  // 3. Pre-fetch last valid comment for each user in this batch to avoid N+1 queries
  const userIds = Array.from(new Set(sortedComments.map(c => c.userId)));
  const lastUserComments = await prisma.comment.findMany({
    where: { 
      gameId,
      userId: { in: userIds },
      status: "VALID"
    },
    orderBy: { timestamp: "desc" },
    // This is a bit tricky with Prisma to get only the LATEST per user in one go,
    // but a simple findMany and then reducing in JS is much faster than N queries.
  });

  // Map of userId -> latest timestamp
  const lastCommentMap = new Map<string, Date>();
  for (const c of lastUserComments) {
    if (!lastCommentMap.has(c.userId)) {
      lastCommentMap.set(c.userId, c.timestamp);
    }
  }

  // 4. Process in a single batch
  let hasNewValid = false;
  let latestValidTime: Date | null = null;

  await prisma.$transaction(async (tx) => {
    for (const ytComment of sortedComments) {
      const lastTimestamp = lastCommentMap.get(ytComment.userId);

      const validation = validateComment(
        {
          text: ytComment.text,
          userId: ytComment.userId,
          lastCommentAt: lastTimestamp,
          currentTimestamp: new Date(ytComment.publishedAt)
        },
        rules
      );

      await tx.comment.create({
        data: {
          gameId,
          commentId: ytComment.id,
          userId: ytComment.userId,
          userName: ytComment.userName,
          userProfilePic: ytComment.userProfilePic,
          text: ytComment.text,
          status: validation.isValid ? "VALID" : "INVALID",
          invalidReason: validation.reason,
          timestamp: new Date(ytComment.publishedAt),
        },
      });

      if (validation.isValid) {
        hasNewValid = true;
        const commentTime = new Date(ytComment.publishedAt);
        if (!latestValidTime || commentTime > latestValidTime) {
          latestValidTime = commentTime;
        }
        // Update the in-memory map so subsequent comments from same user in this batch are checked correctly
        lastCommentMap.set(ytComment.userId, commentTime);
      }
    }

    // 4. Update Game State Once
    if (hasNewValid && latestValidTime) {
      const currentGame = await tx.game.findUnique({ where: { id: gameId } });
      if (currentGame && currentGame.status !== "FINISHED") {
        if (currentGame.status === "WAITING") {
          await tx.game.update({
            where: { id: gameId },
            data: {
              status: "ACTIVE",
              startTime: latestValidTime,
              lastCommentAt: latestValidTime,
            },
          });
        } else if (currentGame.status === "ACTIVE") {
          if (!currentGame.lastCommentAt || latestValidTime > currentGame.lastCommentAt) {
            await tx.game.update({
              where: { id: gameId },
              data: { lastCommentAt: latestValidTime },
            });
          }
        }
      }
    }
  });
}

export async function checkGameEnd(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { _count: { select: { comments: { where: { status: "VALID" } } } } }
  });

  if (!game || game.status !== "ACTIVE" || !game.lastCommentAt || !game.startTime) return;

  const now = new Date();
  
  // 1. Silence Period Check (Point 16 & 20)
  const silencePeriodMs = game.silencePeriod * 1000;
  const timeSinceLastComment = now.getTime() - game.lastCommentAt.getTime();
  const isSilent = timeSinceLastComment >= silencePeriodMs;

  // 2. Absolute Timer Check (Point 11 & 12)
  const validCount = game._count.comments;
  const totalAllocatedMs = (game.baseTimer * 1000) + (Math.max(0, validCount - 1) * game.prolongTime * 1000);
  const absoluteEndTime = new Date(game.startTime.getTime() + totalAllocatedMs);
  const isTimeUp = now >= absoluteEndTime;

  if (isSilent || isTimeUp) {
    await finalizeGame(gameId);
  }
}

async function finalizeGame(gameId: string) {
  try {
    await prisma.$transaction(async (tx) => {
      // Atomic check to ensure we only finalize once
      const game = await tx.game.findUnique({
        where: { id: gameId },
        include: { winners: true }
      });

      if (!game || game.status !== "ACTIVE" || game.winners.length > 0) return;

      // 1. Mark as finished
      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: { status: "FINISHED" },
        include: { 
            comments: { 
              where: { status: "VALID" }, 
              orderBy: [
                { timestamp: "asc" },
                { createdAt: "asc" }
              ] 
            } 
        }
      });

      const validComments = updatedGame.comments;
      if (validComments.length === 0) return;

      // 2. Select winners (Idempotent within this transaction)
      const lastComment = validComments[validComments.length - 1];
      await tx.winner.create({
        data: {
          gameId,
          userId: lastComment.userId,
          commentId: lastComment.commentId,
          userName: lastComment.userName,
          category: "MAIN",
        }
      });

      const lastN = validComments.slice(-(updatedGame.lastNCount + 1), -1).reverse(); 
      for (const c of lastN) {
        await tx.winner.create({
          data: {
            gameId,
            userId: c.userId,
            commentId: c.commentId,
            userName: c.userName,
            category: "LAST_N",
          }
        });
      }

      const firstN = validComments.slice(0, updatedGame.firstNCount);
      if (firstN.length > 0) {
        const randomWinner = firstN[Math.floor(Math.random() * firstN.length)];
        await tx.winner.create({
          data: {
            gameId,
            userId: randomWinner.userId,
            commentId: randomWinner.commentId,
            userName: randomWinner.userName,
            category: "FIRST_N_RANDOM",
          }
        });
      }
    });
  } catch (error) {
    console.error("Finalization error:", error);
  }
}
