-- CreateIndex
CREATE INDEX "Comment_gameId_status_idx" ON "Comment"("gameId", "status");

-- CreateIndex
CREATE INDEX "Comment_gameId_timestamp_idx" ON "Comment"("gameId", "timestamp" DESC);
