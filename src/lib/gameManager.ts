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
    keywords: game.keywords ? JSON.parse(game.keywords) : [],
  };

  // 1. Filter out comments we already have in a single query
  // AND filter out historical comments (those published before game was created in Comentix)
  const commentIds = youtubeComments.map(c => c.id);
  const existingComments = await prisma.comment.findMany({
    where: { 
      gameId,
      commentId: { in: commentIds } 
    },
    select: { commentId: true }
  });
  const existingIds = new Set(existingComments.map(c => c.commentId));
  const newComments = youtubeComments.filter(c => {
    const isNewToDb = !existingIds.has(c.id);
    if (game.includeOldComments) return isNewToDb;

    const publishedTime = new Date(c.publishedAt).getTime();
    // Use 30s buffer for clock drift between YouTube and Server
    const gameCreatedTime = game.createdAt.getTime() - (30 * 1000); 
    return isNewToDb && publishedTime >= gameCreatedTime;
  });

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
          // Transition to ACTIVE using SERVER time
          const now = new Date();
          await tx.game.update({
            where: { id: gameId },
            data: {
              status: "ACTIVE",
              startTime: now,
              lastCommentAt: now,
            },
          });
        } else if (currentGame.status === "ACTIVE") {
          // Robust Silence Timer: Use current server time instead of YouTube's publishedAt
          // This protects against polling delays and ensures participants get the full silence period.
          await tx.game.update({
            where: { id: gameId },
            data: { lastCommentAt: new Date() },
          });
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

  // The game ends ONLY when BOTH the absolute timer is up AND the silence period has passed.
  // This ensures the Base Timer duration is guaranteed.
  if (isSilent && isTimeUp) {
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

      const winnersSet = new Set<string>();

      // 1. MAIN winner (Very last valid comment)
      const mainWinnerComment = validComments[validComments.length - 1];
      await tx.winner.create({
        data: {
          gameId,
          userId: mainWinnerComment.userId,
          commentId: mainWinnerComment.commentId,
          userName: mainWinnerComment.userName,
          category: "MAIN",
        }
      });
      winnersSet.add(mainWinnerComment.userId);

      // 2. LAST_N winners (Unique users who commented before the main winner)
      // Moving backwards from the end, skipping the main winner and already seen users
      let foundLastN = 0;
      for (let i = validComments.length - 2; i >= 0 && foundLastN < updatedGame.lastNCount; i--) {
        const c = validComments[i];
        if (!winnersSet.has(c.userId)) {
          await tx.winner.create({
            data: {
              gameId,
              userId: c.userId,
              commentId: c.commentId,
              userName: c.userName,
              category: "LAST_N",
            }
          });
          winnersSet.add(c.userId);
          foundLastN++;
        }
      }

      // 3. FIRST_N_RANDOM winner (Unique users among the first N participants, excluding current winners)
      // Get unique users from the first firstNCount comments
      const firstNUniqueUsers: any[] = [];
      const seenInFirstN = new Set<string>();
      
      for (const c of validComments.slice(0, updatedGame.firstNCount)) {
        if (!seenInFirstN.has(c.userId)) {
          firstNUniqueUsers.push(c);
          seenInFirstN.add(c.userId);
        }
      }

      // Filter out those who already won something
      const eligibleForRandom = firstNUniqueUsers.filter(c => !winnersSet.has(c.userId));
      
      if (eligibleForRandom.length > 0) {
        const randomWinner = eligibleForRandom[Math.floor(Math.random() * eligibleForRandom.length)];
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
