-- CreateTable
CREATE TABLE "perangkat_notif" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perangkat_notif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifikasi" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "isi" TEXT NOT NULL,
    "tipe" TEXT NOT NULL DEFAULT 'umum',
    "data" TEXT,
    "dibacaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perangkat_notif_token_key" ON "perangkat_notif"("token");

-- CreateIndex
CREATE INDEX "perangkat_notif_userId_idx" ON "perangkat_notif"("userId");

-- CreateIndex
CREATE INDEX "notifikasi_userId_dibacaAt_idx" ON "notifikasi"("userId", "dibacaAt");

-- CreateIndex
CREATE INDEX "notifikasi_userId_createdAt_idx" ON "notifikasi"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "perangkat_notif" ADD CONSTRAINT "perangkat_notif_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifikasi" ADD CONSTRAINT "notifikasi_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
