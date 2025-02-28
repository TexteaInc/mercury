import { createTrackedSelector } from "react-tracked"
import { create } from "zustand"
import { getAllLabels } from "../utils/request"

interface LabelsState {
  candidates: (string | object)[]
  setCandidates: (candidates: (string | object)[]) => void
  fetch: () => Promise<void>
}

export const useLabelsStore = create<LabelsState>()(set => ({
  candidates: [],
  setCandidates: (candidates: (string | object)[]) => set({ candidates }),
  fetch: async () => {
    try {
      const labels = await getAllLabels()
      set({ candidates: labels })
    } catch (e) {
      console.warn(e)
      throw e
    }
  },
}))

export const useTrackedLabelsStore = createTrackedSelector(useLabelsStore)
