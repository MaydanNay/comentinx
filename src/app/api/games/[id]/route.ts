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
    const { isPinned } = body;

    const game = await prisma.game.update({
      where: { id },
      data: { isPinned },
    });

    return NextResponse.json(game);
  } catch (error) {
    console.error("Update game error:", error);
    return NextResponse.json({ error: "Failed to update game" }, { status: 500 });
  }
}
