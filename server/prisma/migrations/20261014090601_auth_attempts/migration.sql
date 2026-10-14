-- CreateTable
CREATE TABLE "auth_attempts" (
    "id" UUID NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "attempted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_attempts_key_hash_attempted_at_idx" ON "auth_attempts"("key_hash", "attempted_at");

-- CreateIndex
CREATE INDEX "auth_attempts_attempted_at_idx" ON "auth_attempts"("attempted_at");
