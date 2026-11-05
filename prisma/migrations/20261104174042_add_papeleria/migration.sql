-- CreateTable
CREATE TABLE "PapeleriaItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PapeleriaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PapeleriaItem_name_idx" ON "PapeleriaItem"("name");
