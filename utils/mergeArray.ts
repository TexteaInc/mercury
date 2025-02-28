import type { SectionResponse, SectionResponseSlice } from "./types"

function mergeArrays(a: SectionResponse, b: SectionResponseSlice): SectionResponse {
  const bStart = b.offset
  const bEnd = b.offset + b.len
  const c = a.slice().sort((x, y) => x.offset - y.offset)

  let i = 0
  const deletes: number[] = []
  while (i < c.length) {
    const start = c[i].offset
    const end = c[i].offset + c[i].len
    if (start >= bStart && end <= bEnd) {
      deletes.push(i)
      i++
    } else if (start <= bEnd && end >= bStart) {
      if (start < bStart) {
        c[i][1] = bStart - 1
      }
      if (end > bEnd) {
        c[i][0] = bEnd + 1
      }
      i++
    } else {
      i++
    }
  }

  for (let j = deletes.length - 1; j >= 0; j--) {
    c.splice(deletes[j], 1)
  }

  let inserted = false

  for (let j = 0; j < c.length; j++) {
    if (bStart < c[j].offset) {
      c.splice(j, 0, b)
      inserted = true
      break
    }
  }

  if (!inserted) {
    c.push(b)
  }
  return c.sort((x, y) => x.offset - y.offset)
}

// start, end, isBackend, score, true_index
function updateSliceArray(text: string, slices: SectionResponse): [number, number, boolean, number, number][] {
  if (slices.length === 0)
    return [[0, text.length - 1, false, 0, -1] as [number, number, boolean, number, number]]
  const sliceArray: [number, number, boolean, number, number][] = []
  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i]
    sliceArray.push([slice.offset, slice.offset + slice.len - 1, true, slice.score, i])
  }
  sliceArray.sort((a, b) => a[0] - b[0])
  const newSliceArray: [number, number, boolean, number, number][] = []
  for (let i = 0; i < sliceArray.length; i++) {
    const currentSlice = sliceArray[i]
    if (i > 0 && currentSlice[0] > sliceArray[i - 1][1]) {
      newSliceArray.push([sliceArray[i - 1][1] + 1, currentSlice[0] - 1, false, 0, -1])
    }
    newSliceArray.push(currentSlice)
  }
  if (sliceArray[sliceArray.length - 1][1] < text.length - 1) {
    newSliceArray.push([sliceArray[sliceArray.length - 1][1] + 1, text.length - 1, false, 0, -1])
  }
  if (newSliceArray[0][0] !== 0) {
    newSliceArray.unshift([0, newSliceArray[0][0] - 1, false, 0, -1])
  }
  return newSliceArray
}

interface HistorySlice {
  text: string
  labeled: boolean
  consistent: string[]
}

function historyTextToSlice(text: string, start: number, end: number, consistent: string[]): HistorySlice[] {
  const range = [start, end]
  const part: HistorySlice[] = []

  if (start === end) {
    return [{ text, labeled: false, consistent }]
  }

  const labeledPart = text.slice(range[0], range[1])
  const unlabeledPartStart = text.slice(0, range[0])
  const unlabeledPartEnd = text.slice(range[1])

  if (unlabeledPartStart.length > 0) {
    part.push({ text: unlabeledPartStart, labeled: false, consistent })
  }

  part.push({ text: labeledPart, labeled: true, consistent })

  if (unlabeledPartEnd.length > 0) {
    part.push({ text: unlabeledPartEnd, labeled: false, consistent })
  }

  return part
}

export { type HistorySlice, historyTextToSlice, mergeArrays, updateSliceArray }
