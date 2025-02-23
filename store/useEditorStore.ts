import type { LabelData, SectionResponse } from "../utils/types";
import { produce } from "immer";
import { createTrackedSelector } from "react-tracked";
import { create } from "zustand";
import { normalizationScore } from "../utils/color";
import { getTaskHistory } from "../utils/request";

interface EditorState {
  serverSection: SectionResponse;
  setServerSection: (section: SectionResponse) => void;
  clearServerSection: () => void;

  history: LabelData[];
  setHistory: (history: LabelData[]) => void;
  fetchHistory: (accessToken: string, taskIndex: number) => Promise<void>;

  viewing: LabelData | null;
  setViewing: (viewing: LabelData | null) => void;
  editing: LabelData | null;
  setEditing: (editing: LabelData | null) => void;

  activeList: Record<number, boolean>;
  setActive: (recordId: number, active: boolean) => void;
  setActiveBatch: (recordIds: number[], active: boolean) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  serverSection: [],
  setServerSection: (section: SectionResponse) =>
    set(produce((state: EditorState) => {
      const scores = section.map((section) => section.score);
      const normalizedScores = normalizationScore(scores);
      state.serverSection = section.map((section, index) => ({
        ...section,
        score: normalizedScores[index],
      }));
    })),
  clearServerSection: () => set({ serverSection: [] }),
  history: [],
  setHistory: (history: LabelData[]) => set({ history }),
  fetchHistory: async (accessToken: string, taskIndex: number) => {
    const history = await getTaskHistory(accessToken, taskIndex);
    const activeList = history.reduce((acc, label) => {
      acc[label.record_id] = true;
      return acc;
    }, {} as Record<number, boolean>);
    set({ history, activeList });
  },

  viewing: null,
  setViewing: (viewing: LabelData | null) => set({ viewing }),
  editing: null,
  setEditing: (editing: LabelData | null) => set({ editing }),

  activeList: {},
  setActive: (recordId: number, active: boolean) =>
    set(produce((state: EditorState) => {
      state.activeList[recordId] = active;
    })),
  setActiveBatch: (recordIds: number[], active: boolean) =>
    set(produce((state: EditorState) => {
      recordIds.forEach((recordId) => {
        state.activeList[recordId] = active;
      });
    })),
}));

export const useTrackedEditorStore = createTrackedSelector(useEditorStore);
