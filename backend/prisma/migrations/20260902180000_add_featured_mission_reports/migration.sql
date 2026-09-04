-- AlterTable
ALTER TABLE `File` ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `File_isFeatured_idx` ON `File`(`isFeatured`);
