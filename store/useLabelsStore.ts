import { createTrackedSelector } from "react-tracked"
import { create } from "zustand"
import { getAllLabels, getAllTitles } from "../utils/request"

interface LabelsState {
  candidates: (string | object)[]
  titles: string[]
  setCandidates: (candidates: (string | object)[]) => void
  setTitles: (titles: string[]) => void
  fetch: () => Promise<void>
}

export const useLabelsStore = create<LabelsState>()(set => ({
  candidates: [],
  titles: ["Source", "Summary"],
  setCandidates: (candidates: (string | object)[]) => set({ candidates }),
  setTitles: (titles: string[]) => set({ titles }),
  fetch: async () => {
    try {
      const labels = await getAllLabels()
      set({ candidates: labels })
    } catch (e) {
      console.warn(e)
      throw e
    }
    try {
      const titles = await getAllTitles()
      set({ titles })
    } catch (e) {
      console.warn(e)
      throw e
    }
  },
}))

export const useTrackedLabelsStore = createTrackedSelector(useLabelsStore)
