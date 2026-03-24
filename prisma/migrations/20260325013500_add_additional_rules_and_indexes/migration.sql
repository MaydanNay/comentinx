-- AlterTable
ALTER TABLE "Game" DROP COLUMN "uniqueParticipantsCount",
ADD COLUMN     "additionalRules" TEXT;

-- CreateIndex
CREATE INDEX "Winner_gameId_idx" ON "Winner"("gameId");
