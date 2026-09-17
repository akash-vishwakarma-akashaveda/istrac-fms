import { prisma } from '../src/config/db.js'
import bcrypt from 'bcrypt'

async function main() {
  console.log('🚀 Seeding ISTRAC Mission Database...')

  // ================================================================
  // 0. PURGE OLD SEEDED & OPERATIONAL RECORDS (CLEAN SLATE ONLY IF EMPTY)
  // ================================================================
  const existingUserCount = await prisma.user.count()
  if (existingUserCount > 0) {
    console.log(`ℹ️ Database already contains ${existingUserCount} user(s). Skipping destructive purge to preserve existing data.`)
    console.log('✅ Existing database data is intact.')
    return
  }

  console.log('🧹 Purging old operational and seeded records for clean slate initial seed...')
  await prisma.fileShareLink.deleteMany()
  await prisma.filePermission.deleteMany()
  await prisma.fileFavorite.deleteMany()
  await prisma.fileTag.deleteMany()
  await prisma.fileVersion.deleteMany()
  await prisma.file.updateMany({ data: { parentId: null } })
  await prisma.file.deleteMany()
  await prisma.reportAccessRequest.deleteMany()
  await prisma.report.deleteMany()
  await prisma.passwordResetToken.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.missionEvent.deleteMany()
  await prisma.userDepartmentAccess.deleteMany()
  await prisma.departmentSatellite.deleteMany()
  await prisma.user.deleteMany()
  await prisma.department.deleteMany()
  await prisma.satellite.deleteMany()
  await prisma.tag.deleteMany()
  console.log('✅ Clean slate established. Proceeding with fresh seed...')

  // ================================================================
  // 1. SATELLITES & MISSION FLEET
  // ================================================================
  const satellitesData = [
    {
      satId: 'ISTRAC-HQ-01',
      name: 'ISTRAC Bengaluru Ground Complex',
      code: 'ISTRAC-BLR',
      description: 'ISRO Telemetry, Tracking and Command Network — Headquarters & MOX Complex',
      launchDate: new Date('1976-09-06'),
      payloads: 'Deep Space S/X-Band Feeds, 32m DSN Antenna, Mission Control Systems',
      fuelBalance: 'N/A (Ground Complex)',
      launchMass: 'Station Complex',
      orbitType: 'Ground Tracking Station',
      status: 'ACTIVE',
    },
    {
      satId: 'SAT-ADITYA-L1',
      name: 'Aditya-L1 Solar Observatory',
      code: 'ADITYA-L1',
      description: 'Lagrange Point L1 Sun-Earth halo orbit coronagraphy & solar wind telemetry monitoring.',
      launchDate: new Date('2023-09-02T06:20:00.000Z'),
      payloads: 'VELC, SUIT, ASPEX, PAPA, SoLEXS, HEL1OS, MAG',
      fuelBalance: '298 kg (78%)',
      launchMass: '1,475 kg',
      orbitType: 'Halo Orbit (L1 Lagrangian)',
      status: 'ACTIVE',
    },
    {
      satId: 'SAT-CH-3',
      name: 'Chandrayaan-3 Lunar Relay',
      code: 'CHANDRAYAAN-3',
      description: 'Lunar south-pole propulsion module relay and deep-space autotrack node.',
      launchDate: new Date('2023-07-14T09:05:00.000Z'),
      payloads: 'SHAPE (Spectro-polarimetry of Habitable Planet Earth), S-Band Transponder',
      fuelBalance: '168 kg (35%)',
      launchMass: '3,900 kg',
      orbitType: 'Lunar Polar Orbit (153 km x 163 km)',
      status: 'ACTIVE',
    },
    {
      satId: 'SAT-CARTO-3',
      name: 'Cartosat-3 Optical Constellation',
      code: 'CARTOSAT-3',
      description: 'Sun-synchronous orbit high-resolution panchromatic & multispectral imaging payload.',
      launchDate: new Date('2019-11-27T03:58:00.000Z'),
      payloads: 'Panchromatic & Multispectral High-Res Optical Sensors (0.28m GSD)',
      fuelBalance: '82 kg (52%)',
      launchMass: '1,625 kg',
      orbitType: 'Sun-Synchronous Polar (SSO, 505 km)',
      status: 'ACTIVE',
    },
    {
      satId: 'SAT-GAGAN-TV1',
      name: 'Gaganyaan Orbital Module',
      code: 'GAGANYAAN',
      description: 'Crew module environmental life-support telemetry & real-time re-entry recovery telemetry.',
      launchDate: new Date('2023-10-21T04:30:00.000Z'),
      payloads: 'Crew Escape System (CES), ECLSS Telemetry, High-G Accelerometers',
      fuelBalance: '420 kg (91%)',
      launchMass: '8,200 kg',
      orbitType: 'Low Earth Orbit (LEO, 400 km)',
      status: 'ACTIVE',
    },
    {
      satId: 'SAT-NISAR-01',
      name: 'NISAR Earth Observatory',
      code: 'NISAR',
      description: 'NASA-ISRO Dual-Frequency Synthetic Aperture Radar environmental dynamics payload.',
      launchDate: new Date('2025-03-30T10:00:00.000Z'),
      payloads: 'L-band SAR (NASA), S-band SAR (ISRO), 12m Deployable Reflector Antenna',
      fuelBalance: '480 kg (99%)',
      launchMass: '2,800 kg',
      orbitType: 'Sun-Synchronous Dawn-Dusk (SSO, 747 km)',
      status: 'ACTIVE',
    },
    {
      satId: 'SAT-GEN-CORE',
      name: 'General Mission Fleet',
      code: 'GENERAL',
      description: 'General non-mission-specific files and shared telemetry documentation.',
      launchDate: new Date('2020-01-01'),
      payloads: 'Multi-Mission Relay & Calibration Data',
      fuelBalance: 'N/A',
      launchMass: 'N/A',
      orbitType: 'Geostationary / LEO',
      status: 'ACTIVE',
    },
  ]

  const seededSats: Record<string, any> = {}
  for (const s of satellitesData) {
    const sat = await prisma.satellite.upsert({
      where: { code: s.code },
      update: {
        satId: s.satId,
        name: s.name,
        description: s.description,
        launchDate: s.launchDate,
        payloads: s.payloads,
        fuelBalance: s.fuelBalance,
        launchMass: s.launchMass,
        orbitType: s.orbitType,
        status: s.status,
      },
      create: {
        satId: s.satId,
        name: s.name,
        code: s.code,
        description: s.description,
        launchDate: s.launchDate,
        payloads: s.payloads,
        fuelBalance: s.fuelBalance,
        launchMass: s.launchMass,
        orbitType: s.orbitType,
        status: s.status,
        isActive: true,
      },
    })
    seededSats[s.code] = sat
  }
  const istrac = seededSats['ISTRAC-BLR']

  // ================================================================
  // 2. ACCOUNTS & ROLES (Default Password: ChangeMe123!)
  // ================================================================
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12)

  // 1. Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@istrac.local' },
    update: {
      passwordHash,
      status: 'ACTIVE',
      role: 'ADMIN',
      designation: 'Director, Mission Operations & Ground Segment',
      phone: '+91-80-2838-4001',
    },
    create: {
      name: 'Super Admin (Director MOX)',
      email: 'admin@istrac.local',
      employeeId: 'ISRO-DIR-001',
      designation: 'Director, Mission Operations & Ground Segment',
      phone: '+91-80-2838-4001',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })

  // Enforce single admin constraint: demote any other users who might hold ADMIN role
  await prisma.user.updateMany({
    where: {
      email: { not: 'admin@istrac.local' },
      role: 'ADMIN',
    },
    data: {
      role: 'MEMBER',
    },
  })

  // ================================================================
  // 3. DEPARTMENTS & CMS SHOWCASE DATA
  // ================================================================
  const departmentsData = [
    {
      name: 'Telemetry, Tracking & Command (TTC)',
      code: 'TTC',
      description: 'Spacecraft health ingestion, carrier tracking, and telecommand transmission across global ground stations.',
      hddPath: '/mnt/istrac_storage/ttc',
      pageTitle: 'Telemetry, Tracking & Command Ground Network',
      pageAbout: 'TTC operates the dedicated ground station antenna network providing continuous telemetry tracking, carrier demodulation, and high-reliability telecommand uplink for Indian satellites in LEO and GTO orbits.',
      pageLeadOfficer: 'Dr. Vikram Sharma',
      pageLeadRole: 'Head, TTC Operations Directorate',
      pageContact: 'ttc-ops@istrac.isro.gov.in',
    },
    {
      name: 'Flight Dynamics Division (FDD)',
      code: 'FDD',
      description: 'Orbit determination, stationkeeping maneuver planning, attitude dynamics, and halo orbit propagation.',
      hddPath: '/mnt/istrac_storage/fdd',
      pageTitle: 'Flight Dynamics & Trajectory Analysis',
      pageAbout: 'The Flight Dynamics Division is responsible for high-precision orbit determination, state vector estimation, interplanetary transfer trajectories, and stationkeeping maneuvers for active Indian space missions.',
      pageLeadOfficer: 'Dr. Ananya Ray',
      pageLeadRole: 'Lead Astrodynamics Specialist',
      pageContact: 'fdd-support@istrac.isro.gov.in',
    },
    {
      name: 'Mission Operations Complex (MOX)',
      code: 'MOX',
      description: 'Real-time payload commanding, spacecraft health telemetry console monitoring, and 24/7 flight operations coordination.',
      hddPath: '/mnt/istrac_storage/mox',
      pageTitle: 'Mission Operations Complex (MOX-1 / MOX-2)',
      pageAbout: 'MOX acts as the 24/7 nerve center for multi-satellite flight operations, managing simultaneous payload commanding, real-time telemetry decommutation, and contingency recovery protocols across global passes.',
      pageLeadOfficer: 'Shri K. R. Nambiar',
      pageLeadRole: 'Director, MOX Ground Segment',
      pageContact: 'mox-control@istrac.isro.gov.in',
    },
    {
      name: 'IS4OM / NETRA Space Situational Awareness',
      code: 'NETRA',
      description: 'Space debris tracking, orbital conjunction assessment, collision avoidance maneuver planning, and space situational awareness.',
      hddPath: '/mnt/istrac_storage/netra',
      pageTitle: 'Network for Space Objects Tracking and Analysis',
      pageAbout: 'NETRA and the IS4OM control center safeguard Indian orbital assets against space debris conjunctions, performing 24/7 collision risk assessments, tracking uncatalogued objects, and scheduling avoidance maneuvers.',
      pageLeadOfficer: 'Dr. A. K. Anilkumar',
      pageLeadRole: 'Project Director, IS4OM / NETRA',
      pageContact: 'netra-ssa@istrac.isro.gov.in',
    },
    {
      name: 'Ground Station Operations (GSO)',
      code: 'GSO',
      description: 'Deep space 32m and 18m antenna dishes, S/X/Ka-band feeds, cryo-receivers, downrange relays, and launch tracking.',
      hddPath: '/mnt/istrac_storage/gso',
      pageTitle: 'Deep Space Ground Station Network (IDSN)',
      pageAbout: 'GSO manages the Indian Deep Space Network at Byalalu, operating 32m and 18m steerable parabolic reflector antenna systems equipped with cryogenic low-noise amplifiers for lunar and deep space communication.',
      pageLeadOfficer: 'Shri B. S. Subhash',
      pageLeadRole: 'General Manager, IDSN Operations',
      pageContact: 'gso-support@istrac.isro.gov.in',
    },
  ]

  const createdDepts: Record<string, any> = {}

  for (const dept of departmentsData) {
    let d = await prisma.department.findFirst({
      where: { satelliteId: istrac.id, name: dept.name, deletedAt: null },
    })

    if (d) {
      d = await prisma.department.update({
        where: { id: d.id },
        data: {
          code: dept.code,
          description: dept.description,
          hddPath: dept.hddPath,
          pageTitle: dept.pageTitle,
          pageAbout: dept.pageAbout,
          pageLeadOfficer: dept.pageLeadOfficer,
          pageLeadRole: dept.pageLeadRole,
          pageContact: dept.pageContact,
        },
      })
    } else {
      d = await prisma.department.create({
        data: {
          satelliteId: istrac.id,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          hddPath: dept.hddPath,
          pageTitle: dept.pageTitle,
          pageAbout: dept.pageAbout,
          pageLeadOfficer: dept.pageLeadOfficer,
          pageLeadRole: dept.pageLeadRole,
          pageContact: dept.pageContact,
          allowUserFolderCreation: true,
          maxFolderDepth: 5,
        },
      })
    }
    createdDepts[dept.code] = d
  }

  // ================================================================
  // 3b. SATELLITE ↔ DEPARTMENT JUNCTION ASSIGNMENTS
  // ================================================================
  const deptSatMap: Record<string, string[]> = {
    MOX: ['ADITYA-L1', 'CHANDRAYAAN-3', 'CARTOSAT-3', 'GAGANYAAN', 'NISAR'],
    TTC: ['ADITYA-L1', 'CHANDRAYAAN-3', 'CARTOSAT-3', 'ISTRAC-BLR'],
    FDD: ['ADITYA-L1', 'CHANDRAYAAN-3', 'CARTOSAT-3', 'NISAR'],
    NETRA: ['CARTOSAT-3', 'GAGANYAAN', 'NISAR'],
    GSO: ['GAGANYAAN', 'NISAR', 'CHANDRAYAAN-3'],
  }

  for (const [deptCode, satCodes] of Object.entries(deptSatMap)) {
    const dept = createdDepts[deptCode]
    if (!dept) continue
    for (const satCode of satCodes) {
      const sat = seededSats[satCode]
      if (sat) {
        await prisma.departmentSatellite.upsert({
          where: {
            departmentId_satelliteId: {
              departmentId: dept.id,
              satelliteId: sat.id,
            },
          },
          update: {},
          create: {
            departmentId: dept.id,
            satelliteId: sat.id,
          },
        })
      }
    }
  }

  // ================================================================
  // 4. USER ↔ DEPARTMENT ACCESS ASSIGNMENTS
  // ================================================================
  // Super Admin gets READ_WRITE across all departments
  for (const code of Object.keys(createdDepts)) {
    await prisma.userDepartmentAccess.upsert({
      where: { userId_departmentId: { userId: superAdmin.id, departmentId: createdDepts[code].id } },
      update: { accessLevel: 'READ_WRITE' },
      create: {
        userId: superAdmin.id,
        departmentId: createdDepts[code].id,
        accessLevel: 'READ_WRITE',
      },
    })
  }

  // ================================================================
  // 5. SEED FILES & REPORTS
  // ================================================================
  const filesData = [
    {
      deptCode: 'TTC',
      name: 'CARTOSAT3_SBAND_PASS_20260825.bin',
      hddPath: '/mnt/istrac_storage/ttc/CARTOSAT3_SBAND_PASS_20260825.bin',
      sizeBytes: 432857088n, // 412.8 MB
      mimeType: 'application/octet-stream',
      extension: 'bin',
      uploaderId: superAdmin.id,
    },
    {
      deptCode: 'FDD',
      name: 'ADITYA_L1_HALO_ORBIT_EPHEMERIS_V4.dat',
      hddPath: '/mnt/istrac_storage/fdd/ADITYA_L1_HALO_ORBIT_EPHEMERIS_V4.dat',
      sizeBytes: 67318579n, // 64.2 MB
      mimeType: 'application/octet-stream',
      extension: 'dat',
      uploaderId: superAdmin.id,
    },
    {
      deptCode: 'NETRA',
      name: 'IS4OM_CONJUNCTION_ASSESSMENT_Q3.pdf',
      hddPath: '/mnt/istrac_storage/netra/IS4OM_CONJUNCTION_ASSESSMENT_Q3.pdf',
      sizeBytes: 19293798n, // 18.4 MB
      mimeType: 'application/pdf',
      extension: 'pdf',
      uploaderId: superAdmin.id,
    },
    {
      deptCode: 'GSO',
      name: 'PSLV_C59_PS4_TELEMETRY_DUMP.csv',
      hddPath: '/mnt/istrac_storage/gso/PSLV_C59_PS4_TELEMETRY_DUMP.csv',
      sizeBytes: 134742016n, // 128.5 MB
      mimeType: 'text/csv',
      extension: 'csv',
      uploaderId: superAdmin.id,
    },
    {
      deptCode: 'MOX',
      name: 'GAGANYAAN_TTC_SIM_REPORT_2026.pdf',
      hddPath: '/mnt/istrac_storage/mox/GAGANYAAN_TTC_SIM_REPORT_2026.pdf',
      sizeBytes: 48024780n, // 45.8 MB
      mimeType: 'application/pdf',
      extension: 'pdf',
      uploaderId: superAdmin.id,
    },
  ]

  for (const f of filesData) {
    await prisma.file.upsert({
      where: { hddPath: f.hddPath },
      update: {},
      create: {
        departmentId: createdDepts[f.deptCode].id,
        nodeType: 'FILE',
        name: f.name,
        hddPath: f.hddPath,
        sizeBytes: f.sizeBytes,
        mimeType: f.mimeType,
        extension: f.extension,
        uploaderId: f.uploaderId,
        status: 'ACTIVE',
      },
    })
  }

  // ================================================================
  // 6. SEED MISSION EVENTS & PASSES
  // ================================================================
  const existingEventsCount = await prisma.missionEvent.count({ where: { deletedAt: null } })
  if (existingEventsCount === 0) {
    const now = new Date()
    const eventsData = [
      {
        title: 'Cartosat-3 Telemetry Downlink Pass',
        description: 'Scheduled S-Band high-rate payload telemetry reception and frame synchronization lock.',
        eventType: 'MISSION_PASS',
        departmentId: createdDepts['TTC']?.id,
        eventDate: new Date(now.getTime() + 1000 * 60 * 45), // +45 mins
        endDate: new Date(now.getTime() + 1000 * 60 * 65),
        location: 'Bengaluru MOX-1 Primary Terminal',
        urgency: 'HIGH',
        status: 'UPCOMING',
      },
      {
        title: 'Aditya-L1 Halo Orbit Stationkeeping Maneuver',
        description: 'Lagrange Point L1 thruster firing burn for halo orbit maintenance and trajectory correction.',
        eventType: 'ORBIT_MANEUVER',
        departmentId: createdDepts['FDD']?.id,
        eventDate: new Date(now.getTime() + 1000 * 60 * 60 * 4), // +4 hours
        endDate: new Date(now.getTime() + 1000 * 60 * 60 * 5),
        location: 'IDSN Byalalu 32m Deep Space Dish',
        urgency: 'CRITICAL',
        status: 'UPCOMING',
      },
      {
        title: 'NETRA IS4OM Space Debris Conjunction Screen',
        description: '72-hour automated LEO screening matrix execution for active Indian spacecraft constellation.',
        eventType: 'SECURITY',
        departmentId: createdDepts['NETRA']?.id,
        eventDate: new Date(now.getTime() + 1000 * 60 * 60 * 8), // +8 hours
        endDate: new Date(now.getTime() + 1000 * 60 * 60 * 9),
        location: 'NETRA Control Facility, Bengaluru',
        urgency: 'NORMAL',
        status: 'UPCOMING',
      },
      {
        title: 'PSLV-C60 Launch Telemetry Readiness Check',
        description: 'Downrange Port Blair and Mauritius telemetry relay synchronization for launch vehicle orbit injection.',
        eventType: 'LAUNCH',
        departmentId: createdDepts['GSO']?.id,
        eventDate: new Date(now.getTime() + 1000 * 60 * 60 * 24), // +24 hours
        endDate: new Date(now.getTime() + 1000 * 60 * 60 * 28),
        location: 'Sriharikota & Downrange Ground Stations',
        urgency: 'CRITICAL',
        status: 'UPCOMING',
      },
      {
        title: 'Gaganyaan ECLSS Telemetry Simulation Pass',
        description: 'Simulated real-time crew cabin environmental telemetry decommutation and audio link verify.',
        eventType: 'MISSION_PASS',
        departmentId: createdDepts['MOX']?.id,
        eventDate: new Date(now.getTime() + 1000 * 60 * 60 * 48), // +48 hours
        endDate: new Date(now.getTime() + 1000 * 60 * 60 * 50),
        location: 'Mission Operations Complex (MOX-2)',
        urgency: 'HIGH',
        status: 'UPCOMING',
      },
    ]

    for (const ev of eventsData) {
      await prisma.missionEvent.create({
        data: {
          title: ev.title,
          description: ev.description,
          eventType: ev.eventType,
          departmentId: ev.departmentId,
          eventDate: ev.eventDate,
          endDate: ev.endDate,
          location: ev.location,
          urgency: ev.urgency,
          status: ev.status,
          createdById: superAdmin.id,
        },
      })
    }
  }

  // ================================================================
  // 7. SEED AUDIT LOGS
  // ================================================================
  const existingAuditCount = await prisma.auditLog.count()
  if (existingAuditCount === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          userId: superAdmin.id,
          action: 'SYSTEM_BOOT',
          resourceType: 'SERVER',
          resourceId: 'ISTRAC-BLR-01',
          newValue: { status: 'INITIALIZED', stations: ['BLR', 'SHAR', 'PBL', 'MAU'] },
        },
        {
          userId: superAdmin.id,
          action: 'FILE_UPLOAD',
          resourceType: 'FILE',
          resourceId: 'CARTOSAT3_SBAND_PASS_20260825.bin',
          newValue: { department: 'TTC', size: '412.8 MB', frames: 14280 },
        },
        {
          userId: superAdmin.id,
          action: 'ORBIT_DETERMINATION',
          resourceType: 'EPHEMERIS',
          resourceId: 'ADITYA-L1-V4',
          newValue: { residuals: '0.042m', trackingStation: 'Byalalu-32m' },
        },
        {
          userId: superAdmin.id,
          action: 'PASS_ACQUISITION',
          resourceType: 'TELEMETRY',
          resourceId: 'CHANDRAYAAN-RELAY',
          newValue: { carrierFrequency: '2.2 GHz', lockStatus: 'NOMINAL' },
        },
      ],
    })
  }

  console.log('\n======================================================')
  console.log('🎉 ISTRAC SEED COMPLETE!')
  console.log('======================================================')
  console.log('📋 Administrator Account Seeded:')
  console.log('   Email:     admin@istrac.local')
  console.log('   Password:  ChangeMe123!')
  console.log('   Role:      ADMIN (Sole System Administrator)')
  console.log('   Note:      Only admin account is seeded. All subsequent')
  console.log('              users will register via /register.')
  console.log('======================================================\n')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
