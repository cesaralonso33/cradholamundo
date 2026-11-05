/*
  Warnings:

  - You are about to drop the column `department` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Employee` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "department",
DROP COLUMN "phone";
