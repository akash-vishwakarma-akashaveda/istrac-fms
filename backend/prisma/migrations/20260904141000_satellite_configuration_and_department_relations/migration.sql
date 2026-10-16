-- DropForeignKey
ALTER TABLE `Department` DROP FOREIGN KEY `Department_satelliteId_fkey`;

-- DropIndex
DROP INDEX `Department_isActive_idx` ON `Department`;

-- DropIndex
DROP INDEX `Department_satelliteId_name_key` ON `Department`;

-- AlterTable
ALTER TABLE `Department` MODIFY `satelliteId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Satellite` ADD COLUMN `fuelBalance` VARCHAR(191) NULL,
    ADD COLUMN `launchDate` DATETIME(3) NULL,
    ADD COLUMN `launchMass` VARCHAR(191) NULL,
    ADD COLUMN `orbitType` VARCHAR(191) NULL,
    ADD COLUMN `payloads` TEXT NULL,
    ADD COLUMN `satId` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    MODIFY `description` TEXT NULL;

-- CreateTable
CREATE TABLE `DepartmentSatellite` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `satelliteId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DepartmentSatellite_departmentId_idx`(`departmentId`),
    INDEX `DepartmentSatellite_satelliteId_idx`(`satelliteId`),
    UNIQUE INDEX `DepartmentSatellite_departmentId_satelliteId_key`(`departmentId`, `satelliteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Department_name_idx` ON `Department`(`name`);

-- CreateIndex
CREATE INDEX `Satellite_satId_idx` ON `Satellite`(`satId`);

-- AddForeignKey
ALTER TABLE `Department` ADD CONSTRAINT `Department_satelliteId_fkey` FOREIGN KEY (`satelliteId`) REFERENCES `Satellite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DepartmentSatellite` ADD CONSTRAINT `DepartmentSatellite_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DepartmentSatellite` ADD CONSTRAINT `DepartmentSatellite_satelliteId_fkey` FOREIGN KEY (`satelliteId`) REFERENCES `Satellite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
