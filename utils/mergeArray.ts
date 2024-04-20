import type { SectionResponse, SectionResponseSlice } from "./types"

const mergeArrays = (a: SectionResponse, b: SectionResponseSlice): SectionResponse => {
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

export default mergeArrays
