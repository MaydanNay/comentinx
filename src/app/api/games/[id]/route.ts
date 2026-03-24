import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authHeader = request.headers.get("Authorization");
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (authHeader !== adminPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete related records first (if needed by DB constraints, though most are cascade or just soft-linked)
    // Comment and Winner records have foreign keys to Game
    await prisma.comment.deleteMany({ where: { gameId: id } });
    await prisma.winner.deleteMany({ where: { gameId: id } });
    await prisma.game.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete game error:", error);
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authHeader = request.headers.get("Authorization");
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (authHeader !== adminPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      isPinned, 
      addSeconds,
      baseTimer,
      prolongTime,
      silencePeriod,
      minWords,
      minChars,
      minSentences,
      antiSpamConfig,
      lastNCount,
      firstNCount,
      prizeMain,
      prizeLastN,
      prizeFirstN,
      prizeRandomAll,
      randomAllCount,
      keywords,
      includeOldComments,
      currency,
      additionalRules
    } = body;

    const data: any = {};
    if (isPinned !== undefined) data.isPinned = isPinned;
    if (baseTimer !== undefined) data.baseTimer = Number(baseTimer);
    if (prolongTime !== undefined) data.prolongTime = Number(prolongTime);
    if (silencePeriod !== undefined) data.silencePeriod = Number(silencePeriod);
    if (minWords !== undefined) data.minWords = Number(minWords);
    if (minChars !== undefined) data.minChars = Number(minChars);
    if (minSentences !== undefined) data.minSentences = Number(minSentences);
    if (antiSpamConfig !== undefined) data.antiSpamConfig = Number(antiSpamConfig);
    if (lastNCount !== undefined) data.lastNCount = Number(lastNCount);
    if (firstNCount !== undefined) data.firstNCount = Number(firstNCount);
    if (prizeMain !== undefined) data.prizeMain = prizeMain;
    if (prizeLastN !== undefined) data.prizeLastN = prizeLastN;
    if (prizeFirstN !== undefined) data.prizeFirstN = prizeFirstN;
    if (prizeRandomAll !== undefined) data.prizeRandomAll = prizeRandomAll;
    if (randomAllCount !== undefined) data.randomAllCount = Number(randomAllCount);
    if (currency !== undefined) data.currency = currency;
    if (includeOldComments !== undefined) data.includeOldComments = includeOldComments;
    if (additionalRules !== undefined) data.additionalRules = additionalRules;
    
    if (keywords !== undefined) {
      data.keywords = typeof keywords === "string" ? keywords : JSON.stringify(keywords);
    }

    if (addSeconds !== undefined && typeof addSeconds === "number" && addSeconds > 0) {
      const currentGame = await prisma.game.findUnique({ where: { id } });
      if (currentGame && currentGame.status === "ACTIVE") {
        if (currentGame.startTime) {
          data.startTime = new Date(currentGame.startTime.getTime() + addSeconds * 1000);
        }
        if (currentGame.lastCommentAt) {
          data.lastCommentAt = new Date(currentGame.lastCommentAt.getTime() + addSeconds * 1000);
        }
      }
    }

    const game = await prisma.game.update({
      where: { id },
      data,
    });

    return NextResponse.json(game);
  } catch (error) {
    console.error("Update game error:", error);
    return NextResponse.json({ error: "Failed to update game" }, { status: 500 });
  }
}
