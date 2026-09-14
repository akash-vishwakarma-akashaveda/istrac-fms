import { apiClient, extractData } from "./client"

export interface MissionEventScheduler {
  interval: number
  unit: 'minutes'
}

export interface UpdateMissionEventSchedulerPayload {
  interval: number
}

export const schedulerApi = {
  async getMissionEventScheduler(): Promise<MissionEventScheduler> {
    const res = await apiClient.get(
      '/admin/scheduler/mission-events'
    )

    return extractData<MissionEventScheduler>(res)
  },

  async updateMissionEventScheduler(
    payload: UpdateMissionEventSchedulerPayload
  ): Promise<MissionEventScheduler> {
    const res = await apiClient.put(
      '/admin/scheduler/mission-events',
      payload
    )

    return extractData<MissionEventScheduler>(res)
  },
}