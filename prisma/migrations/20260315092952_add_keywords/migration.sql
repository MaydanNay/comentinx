-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "startTime" DATETIME,
    "baseTimer" INTEGER NOT NULL,
    "prolongTime" INTEGER NOT NULL,
    "silencePeriod" INTEGER NOT NULL,
    "minWords" INTEGER NOT NULL DEFAULT 0,
    "minChars" INTEGER NOT NULL DEFAULT 0,
    "minSentences" INTEGER NOT NULL DEFAULT 0,
    "antiSpamConfig" INTEGER NOT NULL DEFAULT 0,
    "lastCommentAt" DATETIME,
    "lastNCount" INTEGER NOT NULL DEFAULT 3,
    "firstNCount" INTEGER NOT NULL DEFAULT 10,
    "prizeMain" TEXT,
    "prizeLastN" TEXT,
    "prizeFirstN" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "likeCount" TEXT,
    "videoTitle" TEXT,
    "viewCount" TEXT,
    "keywords" TEXT
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userProfilePic" TEXT,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "invalidReason" TEXT,
    "timestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Winner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentId" TEXT,
    CONSTRAINT "Winner_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Comment_commentId_key" ON "Comment"("commentId");
