import { prisma } from '../config/db.js'
import { hddService } from './hdd.service.js'

const DEFAULT_SATELLITES = [
  {
    name: 'Aditya-L1 Solar Observatory',
    code: 'ADITYAL1',
    noradId: 57714,
    orbitType: 'L1 Lagrange Halo',
    status: 'ACTIVE' as const,
    description: 'ISRO Sun-Earth Lagrange point solar coronagraphy & space weather observatory.',
  },
  {
    name: 'Chandrayaan-3 Lunar Mission',
    code: 'CHANDRAYAAN3',
    noradId: 57320,
    orbitType: 'Lunar Orbit / Surface',
    status: 'ACTIVE' as const,
    description: 'ISRO lunar south pole surface exploration and propulsion module communications.',
  },
  {
    name: 'EOS-08 Earth Observation Satellite',
    code: 'EOS08',
    noradId: 60490,
    orbitType: 'Low Earth Orbit (LEO)',
    status: 'ACTIVE' as const,
    description: 'Micro-satellite payload with Electro-Optical Infrared & Global Navigation Reflectometry.',
  },
  {
    name: 'Cartosat-3 Imaging Satellite',
    code: 'CARTOSAT3',
    noradId: 44804,
    orbitType: 'Sun Synchronous (SSO)',
    status: 'ACTIVE' as const,
    description: 'Very high resolution sub-meter optical earth observation and cartography.',
  },
  {
    name: 'Gaganyaan Orbital Module',
    code: 'GAGANYAAN',
    noradId: 99001,
    orbitType: 'Low Earth Orbit (LEO)',
    status: 'ACTIVE' as const,
    description: 'Indian Human Spaceflight Programme crew module telemetry and descent tracking.',
  },
  {
    name: 'NISAR Earth Science Mission',
    code: 'NISAR',
    noradId: 99002,
    orbitType: 'Sun Synchronous (SSO)',
    status: 'ACTIVE' as const,
    description: 'Dual-frequency L-band and S-band Synthetic Aperture Radar joint earth science observatory.',
  },
]

const DEFAULT_DEPARTMENTS = [
  {
    name: 'Telemetry, Tracking & Command (TTC)',
    code: 'TTC',
    description: 'Spacecraft ground station RF tracking passes, ranging telemetry, and telecommand verification.',
    hddPath: '/TTC',
  },
  {
    name: 'Flight Dynamics Division (FDD)',
    code: 'FDD',
    description: 'Orbit determination, trajectory propagation, maneuver calibration, and station-keeping.',
    hddPath: '/FDD',
  },
  {
    name: 'Mission Operations Complex (MOX)',
    code: 'MOX',
    description: 'Primary 24/7 mission control room logs, spacecraft subsystem monitoring, and shift summaries.',
    hddPath: '/MOX',
  },
  {
    name: 'Network for Space Object Tracking & Analysis (NETRA)',
    code: 'NETRA',
    description: 'Space situational awareness, orbital debris conjunction assessment, and collision avoidance.',
    hddPath: '/NETRA',
  },
  {
    name: 'Geostationary Satellite Operations (GSO)',
    code: 'GSO',
    description: 'Communication and meteorological geostationary payload telemetry management.',
    hddPath: '/GSO',
  },
]

export const bootstrapService = {
  /**
   * Checks whether the ground station has initialized satellites, departments, and storage.
   */
  async getInitializationState() {
    const [satCount, deptCount, storageStatus] = await Promise.all([
      prisma.satellite.count({ where: { deletedAt: null } }),
      prisma.department.count({ where: { deletedAt: null } }),
      hddService.getMountStatus(),
    ])

    return {
      satellitesCount: satCount,
      departmentsCount: deptCount,
      storageMounted: storageStatus.mounted,
      isFreshInstall: satCount === 0 || deptCount === 0 || !storageStatus.mounted,
    }
  },

  /**
   * Seeds default satellites, departments, and initializes the physical storage array in one operation.
   */
  async bootstrapDefaults(customStoragePath?: string) {
    // 1. Initialize storage drive hierarchy
    const mountResult = await hddService.initializeMount(customStoragePath)

    // 2. Ensure default satellites exist
    const satellitesCreated = []
    const existingSats = await prisma.satellite.findMany({ where: { deletedAt: null } })
    const existingCodes = new Set(existingSats.map((s) => s.code))

    for (const s of DEFAULT_SATELLITES) {
      if (!existingCodes.has(s.code)) {
        const created = await prisma.satellite.create({
          data: s,
        })
        satellitesCreated.push(created)
      }
    }

    // Get primary satellite for department linkage
    const primarySat = (await prisma.satellite.findFirst({ where: { deletedAt: null } })) || satellitesCreated[0]

    // 3. Ensure default departments exist
    const departmentsCreated = []
    const existingDepts = await prisma.department.findMany({ where: { deletedAt: null } })
    const existingDeptCodes = new Set(existingDepts.map((d) => d.code))

    if (primarySat) {
      for (const d of DEFAULT_DEPARTMENTS) {
        if (!existingDeptCodes.has(d.code)) {
          const created = await prisma.department.create({
            data: {
              satelliteId: primarySat.id,
              name: d.name,
              code: d.code,
              description: d.description,
              hddPath: d.hddPath,
              isActive: true,
              allowUserFolderCreation: true,
              maxFolderDepth: 5,
            },
          })
          departmentsCreated.push(created)
        }
      }
    }

    return {
      mountResult,
      satellitesCreated: satellitesCreated.length,
      departmentsCreated: departmentsCreated.length,
      totalSatellites: (await prisma.satellite.count({ where: { deletedAt: null } })),
      totalDepartments: (await prisma.department.count({ where: { deletedAt: null } })),
    }
  },
}
