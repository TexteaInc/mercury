import { produce } from "immer"

const serverColors = [
  "#c4ebff",
  "#a8e1ff",
  "#70cdff",
  "#38baff",
  "#1cb0ff",
  "#00a6ff",
]

export function getServerColor(score: number) {
  return serverColors[Math.floor(score * (serverColors.length - 1))]
}

export function normalizationScore(score: number[]) {
  return produce(score, (draft) => {
    if (draft.length === 0)
      return []
    if (draft.length === 1)
      return [1]
    const minScore = Math.min(...draft)
    const maxScore = Math.max(...draft)
    for (let i = 0; i < draft.length; i++) {
      draft[i] = (draft[i] - minScore) / (maxScore - minScore)
    }
  })
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
  }
  return hash
}

export function generateUserColor(userId: string, recordId: number) {
  const hash = simpleHash(userId)
  const h = (hash + recordId * 10) % 360
  const s = 70
  const l = 60
  return `hsl(${h}, ${s}%, ${l}%)`
}
