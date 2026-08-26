-- AlterTable
ALTER TABLE `User` 
    ADD COLUMN `designation` VARCHAR(191) NULL AFTER `name`,
    ADD COLUMN `phone` VARCHAR(191) NULL AFTER `employeeId`,
    ADD COLUMN `departmentPreference` VARCHAR(191) NULL AFTER `phone`,
    ADD COLUMN `reasonForAccess` TEXT NULL AFTER `departmentPreference`;

-- AlterTable
ALTER TABLE `Department` 
    ADD COLUMN `pageTitle` VARCHAR(191) NULL,
    ADD COLUMN `pageAbout` TEXT NULL,
    ADD COLUMN `pageLeadOfficer` VARCHAR(191) NULL,
    ADD COLUMN `pageLeadRole` VARCHAR(191) NULL,
    ADD COLUMN `pageContact` VARCHAR(191) NULL,
    ADD COLUMN `pageBannerUrl` TEXT NULL,
    ADD COLUMN `isPageEnabled` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Report` 
    ADD COLUMN `customCategory` VARCHAR(191) NULL,
    ADD COLUMN `namingConvention` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `SystemConfig` 
    MODIFY `configValue` LONGTEXT NOT NULL;

-- CreateTable
CREATE TABLE `MissionEvent` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `eventType` VARCHAR(191) NOT NULL DEFAULT 'MISSION_PASS',
    `satelliteId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `eventDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `location` VARCHAR(191) NULL,
    `urgency` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `status` VARCHAR(191) NOT NULL DEFAULT 'UPCOMING',
    `showOnBanner` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `MissionEvent_eventDate_idx`(`eventDate`),
    INDEX `MissionEvent_status_idx`(`status`),
    INDEX `MissionEvent_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportCategoryPreset` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReportCategoryPreset_name_key`(`name`),
    UNIQUE INDEX `ReportCategoryPreset_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NamingPreset` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `template` TEXT NOT NULL,
    `description` TEXT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NamingPreset_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MissionEvent` ADD CONSTRAINT `MissionEvent_satelliteId_fkey` FOREIGN KEY (`satelliteId`) REFERENCES `Satellite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MissionEvent` ADD CONSTRAINT `MissionEvent_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
