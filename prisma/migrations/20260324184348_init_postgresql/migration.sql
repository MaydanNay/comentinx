-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "startTime" TIMESTAMP(3),
    "baseTimer" INTEGER NOT NULL,
    "prolongTime" INTEGER NOT NULL,
    "silencePeriod" INTEGER NOT NULL,
    "minWords" INTEGER NOT NULL DEFAULT 1,
    "minChars" INTEGER NOT NULL DEFAULT 3,
    "minSentences" INTEGER NOT NULL DEFAULT 0,
    "antiSpamConfig" INTEGER NOT NULL DEFAULT 0,
    "lastCommentAt" TIMESTAMP(3),
    "lastNCount" INTEGER NOT NULL DEFAULT 3,
    "firstNCount" INTEGER NOT NULL DEFAULT 10,
    "prizeMain" TEXT,
    "prizeLastN" TEXT,
    "prizeFirstN" TEXT,
    "prizeRandomAll" TEXT,
    "randomAllCount" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT '$',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "likeCount" TEXT,
    "videoTitle" TEXT,
    "viewCount" TEXT,
    "keywords" TEXT,
    "includeOldComments" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "uniqueParticipantsCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userProfilePic" TEXT,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "invalidReason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winner" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentId" TEXT,

    CONSTRAINT "Winner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Comment_gameId_commentId_key" ON "Comment"("gameId", "commentId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
