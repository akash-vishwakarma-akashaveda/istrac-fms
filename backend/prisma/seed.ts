import { prisma } from '../src/config/db.js'
import bcrypt from 'bcrypt'

async function main() {
  console.log('Seeding ISTRAC Mission Database...')

  // ================================================================
  // SATELLITES & MISSION FLEET
  // ================================================================
  const satellitesData = [
    {
      name: 'ISTRAC Bengaluru Ground Complex',
      code: 'ISTRAC-BLR',
      description: 'ISRO Telemetry, Tracking and Command Network — Headquarters & MOX Complex',
    },
    {
      name: 'Aditya-L1 Solar Observatory',
      code: 'ADITYA-L1',
      description: 'Lagrange Point L1 Sun-Earth halo orbit coronagraphy & solar wind telemetry monitoring.',
    },
    {
      name: 'Chandrayaan-3 Lunar Relay',
      code: 'CHANDRAYAAN-3',
      description: 'Lunar south-pole propulsion module relay and deep-space autotrack node.',
    },
    {
      name: 'Cartosat-3 Optical Constellation',
      code: 'CARTOSAT-3',
      description: 'Sun-synchronous orbit high-resolution panchromatic & multispectral imaging payload.',
    },
    {
      name: 'Gaganyaan Orbital Module',
      code: 'GAGANYAAN',
      description: 'Crew module environmental life-support telemetry & real-time re-entry recovery telemetry.',
    },
    {
      name: 'NISAR Earth Observatory',
      code: 'NISAR',
      description: 'NASA-ISRO Dual-Frequency Synthetic Aperture Radar environmental dynamics payload.',
    },
  ]

  const seededSats: Record<string, any> = {}
  for (const s of satellitesData) {
    const sat = await prisma.satellite.upsert({
      where: { code: s.code },
      update: { name: s.name, description: s.description },
      create: {
        name: s.name,
        code: s.code,
        description: s.description,
        isActive: true,
      },
    })
    seededSats[s.code] = sat
  }
  const istrac = seededSats['ISTRAC-BLR']

  // ================================================================
  // ACCOUNTS & ROLES (Password: ChangeMe123!)
  // ================================================================
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12)

  // 1. Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@istrac.local' },
    update: { passwordHash, status: 'ACTIVE', role: 'ADMIN' },
    create: {
      name: 'Super Admin (Director MOX)',
      email: 'admin@istrac.local',
      employeeId: 'ISRO-DIR-001',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })

  // 2. Department Admin (TTC)
  const ttcAdmin = await prisma.user.upsert({
    where: { email: 'ttcadmin@istrac.local' },
    update: { passwordHash, status: 'ACTIVE', role: 'ADMIN' },
    create: {
      name: 'Dr. Vikram Sharma (Head TTC)',
      email: 'ttcadmin@istrac.local',
      employeeId: 'ISRO-TTC-042',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })

  // 3. Flight Dynamics Lead (FDD)
  const fddLead = await prisma.user.upsert({
    where: { email: 'fddlead@istrac.local' },
    update: { passwordHash, status: 'ACTIVE', role: 'MEMBER' },
    create: {
      name: 'Dr. Ananya Ray (Orbital Mechanics Lead)',
      email: 'fddlead@istrac.local',
      employeeId: 'ISRO-FDD-089',
      passwordHash,
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  })

  // 4. Mission Flight Operator (MOX)
  const operator = await prisma.user.upsert({
    where: { email: 'operator@istrac.local' },
    update: { passwordHash, status: 'ACTIVE', role: 'MEMBER' },
    create: {
      name: 'Ayan Sharma (Telemetry Flight Operator)',
      email: 'operator@istrac.local',
      employeeId: 'ISRO-OPS-108',
      passwordHash,
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  })

  // 5. Space Situational Analyst (NETRA)
  const netraAnalyst = await prisma.user.upsert({
    where: { email: 'netra@istrac.local' },
    update: { passwordHash, status: 'ACTIVE', role: 'MEMBER' },
    create: {
      name: 'Rohan Deshmukh (Conjunction Screening Analyst)',
      email: 'netra@istrac.local',
      employeeId: 'ISRO-SSA-015',
      passwordHash,
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  })

  // 6. Pending Applicant (For testing the Approval Queue!)
  const pendingApplicant = await prisma.user.upsert({
    where: { email: 'applicant@istrac.local' },
    update: { passwordHash, status: 'PENDING', role: 'MEMBER' },
    create: {
      name: 'Priya Nair (Junior Orbit Analyst)',
      email: 'applicant@istrac.local',
      employeeId: 'ISRO-REQ-2026',
      passwordHash,
      role: 'MEMBER',
      status: 'PENDING',
    },
  })

  // ================================================================
  // DEPARTMENTS
  // ================================================================
  const departmentsData = [
    {
      name: 'Telemetry, Tracking & Command (TTC)',
      code: 'TTC',
      description: 'Spacecraft health ingestion, carrier tracking, and telecommand transmission.',
      hddPath: '/mnt/istrac_storage/ttc',
    },
    {
      name: 'Flight Dynamics Division (FDD)',
      code: 'FDD',
      description: 'Orbit determination, stationkeeping maneuver planning, and attitude determination.',
      hddPath: '/mnt/istrac_storage/fdd',
    },
    {
      name: 'Mission Operations Complex (MOX)',
      code: 'MOX',
      description: 'Payload commanding, real-time telemetry console monitoring, and pass deconfliction.',
      hddPath: '/mnt/istrac_storage/mox',
    },
    {
      name: 'IS4OM / NETRA Space Situational Awareness',
      code: 'NETRA',
      description: 'Space debris tracking, orbital conjunction assessment, and collision avoidance screening.',
      hddPath: '/mnt/istrac_storage/netra',
    },
    {
      name: 'Ground Station Operations (GSO)',
      code: 'GSO',
      description: 'Deep space 32m antenna dishes, S/X/Ka-band feeds, cryo-receivers, and downrange links.',
      hddPath: '/mnt/istrac_storage/gso',
    },
  ]

  const createdDepts: Record<string, any> = {}

  for (const dept of departmentsData) {
    const d = await prisma.department.upsert({
      where: { satelliteId_name: { satelliteId: istrac.id, name: dept.name } },
      update: { code: dept.code, description: dept.description, hddPath: dept.hddPath },
      create: {
        satelliteId: istrac.id,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        hddPath: dept.hddPath,
        allowUserFolderCreation: true,
        maxFolderDepth: 5,
      },
    })
    createdDepts[dept.code] = d
  }

  // ================================================================
  // USER ↔ DEPARTMENT ACCESS ASSIGNMENTS
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

  // TTC Admin gets READ_WRITE on TTC and READ_ONLY on others
  await prisma.userDepartmentAccess.upsert({
    where: { userId_departmentId: { userId: ttcAdmin.id, departmentId: createdDepts['TTC'].id } },
    update: { accessLevel: 'READ_WRITE' },
    create: {
      userId: ttcAdmin.id,
      departmentId: createdDepts['TTC'].id,
      accessLevel: 'READ_WRITE',
    },
  })

  // Flight Dynamics Lead gets READ_WRITE on FDD
  await prisma.userDepartmentAccess.upsert({
    where: { userId_departmentId: { userId: fddLead.id, departmentId: createdDepts['FDD'].id } },
    update: { accessLevel: 'READ_WRITE' },
    create: {
      userId: fddLead.id,
      departmentId: createdDepts['FDD'].id,
      accessLevel: 'READ_WRITE',
    },
  })

  // Operator gets READ_WRITE on MOX and TTC
  await prisma.userDepartmentAccess.upsert({
    where: { userId_departmentId: { userId: operator.id, departmentId: createdDepts['MOX'].id } },
    update: { accessLevel: 'READ_WRITE' },
    create: {
      userId: operator.id,
      departmentId: createdDepts['MOX'].id,
      accessLevel: 'READ_WRITE',
    },
  })

  await prisma.userDepartmentAccess.upsert({
    where: { userId_departmentId: { userId: operator.id, departmentId: createdDepts['TTC'].id } },
    update: { accessLevel: 'READ_ONLY' },
    create: {
      userId: operator.id,
      departmentId: createdDepts['TTC'].id,
      accessLevel: 'READ_ONLY',
    },
  })

  // NETRA analyst gets READ_WRITE on NETRA
  await prisma.userDepartmentAccess.upsert({
    where: { userId_departmentId: { userId: netraAnalyst.id, departmentId: createdDepts['NETRA'].id } },
    update: { accessLevel: 'READ_WRITE' },
    create: {
      userId: netraAnalyst.id,
      departmentId: createdDepts['NETRA'].id,
      accessLevel: 'READ_WRITE',
    },
  })

  // ================================================================
  // SEED FILES & REPORTS
  // ================================================================
  const filesData = [
    {
      deptCode: 'TTC',
      name: 'CARTOSAT3_SBAND_PASS_20260825.bin',
      hddPath: '/mnt/istrac_storage/ttc/CARTOSAT3_SBAND_PASS_20260825.bin',
      sizeBytes: 432857088n, // 412.8 MB
      mimeType: 'application/octet-stream',
      extension: 'bin',
      uploaderId: ttcAdmin.id,
    },
    {
      deptCode: 'FDD',
      name: 'ADITYA_L1_HALO_ORBIT_EPHEMERIS_V4.dat',
      hddPath: '/mnt/istrac_storage/fdd/ADITYA_L1_HALO_ORBIT_EPHEMERIS_V4.dat',
      sizeBytes: 67318579n, // 64.2 MB
      mimeType: 'application/octet-stream',
      extension: 'dat',
      uploaderId: fddLead.id,
    },
    {
      deptCode: 'NETRA',
      name: 'IS4OM_CONJUNCTION_ASSESSMENT_Q3.pdf',
      hddPath: '/mnt/istrac_storage/netra/IS4OM_CONJUNCTION_ASSESSMENT_Q3.pdf',
      sizeBytes: 19293798n, // 18.4 MB
      mimeType: 'application/pdf',
      extension: 'pdf',
      uploaderId: netraAnalyst.id,
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
      uploaderId: operator.id,
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
  // SEED AUDIT LOGS
  // ================================================================
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
        userId: ttcAdmin.id,
        action: 'FILE_UPLOAD',
        resourceType: 'FILE',
        resourceId: 'CARTOSAT3_SBAND_PASS_20260825.bin',
        newValue: { department: 'TTC', size: '412.8 MB', frames: 14280 },
      },
      {
        userId: fddLead.id,
        action: 'ORBIT_DETERMINATION',
        resourceType: 'EPHEMERIS',
        resourceId: 'ADITYA-L1-V4',
        newValue: { residuals: '0.042m', trackingStation: 'Byalalu-32m' },
      },
      {
        userId: operator.id,
        action: 'PASS_ACQUISITION',
        resourceType: 'TELEMETRY',
        resourceId: 'CHANDRAYAAN-RELAY',
        newValue: { carrierFrequency: '2.2 GHz', lockStatus: 'NOMINAL' },
      },
    ],
  })

  console.log('\n======================================================')
  console.log('🎉 ISTRAC SEED COMPLETE!')
  console.log('======================================================')
  console.log('📋 Test Accounts Created (Default Password: ChangeMe123!):')
  console.log('  1. Super Admin:      admin@istrac.local     (ADMIN - Full System Access)')
  console.log('  2. Dept Admin (TTC): ttcadmin@istrac.local  (ADMIN - TTC Division Head)')
  console.log('  3. FDD Lead:         fddlead@istrac.local   (MEMBER - Flight Dynamics)')
  console.log('  4. Operator (MOX):   operator@istrac.local  (MEMBER - Mission Control)')
  console.log('  5. NETRA Analyst:    netra@istrac.local     (MEMBER - SSA Specialist)')
  console.log('  6. Pending User:     applicant@istrac.local (PENDING - Test Approval Queue)')
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