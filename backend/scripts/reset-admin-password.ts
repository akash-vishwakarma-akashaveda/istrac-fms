import { prisma } from '../src/config/db.js'
import bcrypt from 'bcrypt'

function validatePassword(password: string): void {
  if (password.length < 10) {
    throw new Error('Password must be at least 10 characters long.')
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter.')
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Password must contain at least one number.')
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new Error('Password must contain at least one special character.')
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  
  let targetEmail = 'admin@istrac.local'
  let newPassword = ''

  if (args.length === 1) {
    if (args[0].includes('@')) {
      targetEmail = args[0]
    } else {
      newPassword = args[0]
    }
  } else if (args.length >= 2) {
    targetEmail = args[0]
    newPassword = args[1]
  }

  // Fallback default compliant password if none was supplied as argument
  if (!newPassword) {
    newPassword = 'Admin@ISTRAC2026!'
  }

  try {
    validatePassword(newPassword)
  } catch (err: any) {
    console.error(`\n❌ Validation Error: ${err.message}\n`)
    process.exit(1)
  }

  console.log('\n🔍 Locating System Administrator account...')

  // Look for existing ADMIN
  let admin = await prisma.user.findFirst({
    where: {
      OR: [
        { role: 'ADMIN', deletedAt: null },
        { email: targetEmail, deletedAt: null },
      ],
    },
  })

  const passwordHash = await bcrypt.hash(newPassword, 12)

  if (!admin) {
    console.log('⚠️ No administrator found. Provisioning root administrator account...')
    admin = await prisma.user.create({
      data: {
        name: 'Super Admin (Director MOX)',
        email: targetEmail,
        employeeId: 'ISRO-DIR-001',
        designation: 'Director, Mission Operations & Ground Segment',
        phone: '+91-80-2838-4001',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    })
  } else {
    // Update existing admin password and ensure role is ADMIN & status is ACTIVE
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        role: 'ADMIN',
      },
    })
  }

  // Invalidate any existing refresh tokens & reset tokens
  await prisma.refreshToken.deleteMany({
    where: { userId: admin.id },
  })
  await prisma.passwordResetToken.deleteMany({
    where: { userId: admin.id },
  })

  // Enforce single admin constraint: ensure no other user holds the ADMIN role
  const demoted = await prisma.user.updateMany({
    where: {
      id: { not: admin.id },
      role: 'ADMIN',
    },
    data: {
      role: 'MEMBER',
    },
  })

  // Log audit entry
  try {
    await prisma.auditLog.create({
      data: {
        user: { connect: { id: admin.id } },
        action: 'PASSWORD_RESET_VIA_TERMINAL_CLI',
        resourceType: 'user',
        resourceId: admin.id,
        newValue: {
          email: admin.email,
          method: 'CLI_TERMINAL',
          timestamp: new Date().toISOString(),
        },
      },
    })
  } catch {
    // Ignore audit log error if not blocking
  }

  console.log('\n' + '='.repeat(76))
  console.log(' [SUCCESS] SYSTEM ADMINISTRATOR CREDENTIAL RESET COMPLETED')
  console.log('='.repeat(76))
  console.log(` Administrator:   ${admin.name}`)
  console.log(` Official Email:  ${admin.email}`)
  console.log(` Employee ID:     ${admin.employeeId || 'N/A'}`)
  console.log(` Role:            ${admin.role} (Sole Administrator)`)
  console.log(` Status:          ACTIVE`)
  console.log(` New Password:    ${newPassword}`)
  if (demoted.count > 0) {
    console.log(` Single Admin:    Demoted ${demoted.count} secondary admin(s) to MEMBER to preserve single-admin constraint.`)
  }
  console.log('')
  console.log(' Prior active sessions have been revoked.')
  console.log(' You may now sign in at the portal login screen using the credentials above.')
  console.log('='.repeat(76) + '\n')

  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ Failed to reset administrator password:', err)
  process.exit(1)
})
