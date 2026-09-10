import { prisma } from '../config/db.js'

export const updateMissionEventStatuses = async () => {
  const now = new Date()

  try {
    // 1. Mark events that were UPCOMING but already expired past their endDate
    const expiredUpcoming = await prisma.missionEvent.updateMany({
      where: {
        deletedAt: null,
        status: 'UPCOMING',
        endDate: {
          not: null,
          lte: now,
        },
      },
      data: {
        status: 'TIMED_OUT',
      },
    })

    // 2. Mark active events: started, and either has no endDate or endDate is still in the future
    const inProgress = await prisma.missionEvent.updateMany({
      where: {
        deletedAt: null,
        status: 'UPCOMING',
        eventDate: {
          lte: now,
        },
        OR: [
          { endDate: null },
          { endDate: { gt: now } },
        ],
      },
      data: {
        status: 'IN_PROGRESS',
      },
    })

    // 3. Mark events that were IN_PROGRESS and just passed their endDate
    const timedOut = await prisma.missionEvent.updateMany({
      where: {
        deletedAt: null,
        status: 'IN_PROGRESS',
        endDate: {
          not: null,
          lte: now,
        },
      },
      data: {
        status: 'TIMED_OUT',
      },
    })

    console.log(
      `[Mission Event Job] Ran status sync at ${now.toISOString()}: ` +
      `${expiredUpcoming.count} expired UPCOMING → TIMED_OUT | ` +
      `${inProgress.count} → IN_PROGRESS | ` +
      `${timedOut.count} → TIMED_OUT`
    )
  } catch (error) {
    console.error('[Mission Event Job] Failed to update statuses:', error)
    throw error
  }
}