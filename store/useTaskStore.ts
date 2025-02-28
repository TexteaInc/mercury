import type { Task } from "../utils/types"
import { createTrackedSelector } from "react-tracked"
import { create } from "zustand"
import { getSingleTask } from "../utils/request"
import { handleRequestError, isRequestError } from "../utils/types"

interface TaskState {
  current: Task | null
  fetch: (index: number) => Promise<void>
}

export const useTaskStore = create<TaskState>()(set => ({
  current: null,
  fetch: async (index: number) => {
    try {
      const task = await getSingleTask(index)
      if (isRequestError(task)) {
        handleRequestError(task)
        return
      }
      set({ current: task })
    } catch (e) {
      set({ current: null })
      console.warn(e)
      throw e
    }
  },
}))

export const useTrackedTaskStore = createTrackedSelector(useTaskStore)
