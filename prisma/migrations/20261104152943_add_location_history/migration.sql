-- CreateTable
CREATE TABLE "LocationHistory" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "from_location" TEXT,
    "to_location" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationHistory_product_id_idx" ON "LocationHistory"("product_id");

-- AddForeignKey
ALTER TABLE "LocationHistory" ADD CONSTRAINT "LocationHistory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
