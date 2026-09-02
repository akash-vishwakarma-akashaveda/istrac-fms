import { prisma } from '../config/db.js'

export const updateMissionEventStatuses = async () => {
  const now = new Date()

  try {
    // ========================================================
    // UPCOMING → IN_PROGRESS
    //
    // Event has started.
    //
    // If endDate exists:
    //     endDate must not have been reached.
    //
    // If endDate does not exist:
    //     event remains IN_PROGRESS until admin changes it.
    // ========================================================

    const inProgressResult = await prisma.missionEvent.updateMany({
      where: {
        deletedAt: null,

        status: 'UPCOMING',

        eventDate: {
          lte: now,
        },

        OR: [
          {
            endDate: null,
          },
          {
            endDate: {
              gt: now,
            },
          },
        ],
      },

      data: {
        status: 'IN_PROGRESS',
      },
    })

    // ========================================================
    // IN_PROGRESS → TIMED_OUT
    //
    // Only events with an endDate can become TIMED_OUT.
    // ========================================================

    const timedOutResult = await prisma.missionEvent.updateMany({
      where: {
        deletedAt: null,

        status: 'IN_PROGRESS',

        endDate: {
          lte: now,
        },
      },

      data: {
        status: 'TIMED_OUT',
      },
    })

    if (
      inProgressResult.count > 0 ||
      timedOutResult.count > 0
    ) {
      console.log(
        `[Mission Event Job] ` +
        `${inProgressResult.count} → IN_PROGRESS | ` +
        `${timedOutResult.count} → TIMED_OUT`
      )
    }
  } catch (error) {
    console.error(
      '[Mission Event Job] Failed to update statuses:',
      error
    )

    throw error
  }
}