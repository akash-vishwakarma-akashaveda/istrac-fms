-- AlterTable
ALTER TABLE `FileVersion`
  ADD COLUMN `versionLabel` VARCHAR(191) NULL DEFAULT 'V1.0',
  ADD COLUMN `isVisible` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `changeLog` TEXT NULL,
  ADD COLUMN `name` VARCHAR(191) NULL,
  ADD COLUMN `mimeType` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `FileVersion_isVisible_idx` ON `FileVersion`(`isVisible`);
