export type Task = {
  doc: string
  sum: string
}

export type AllTasksLength = {
  all: number
}

export type LabelRequest = {
  summary_start: number
  summary_end: number
  source_start: number
  source_end: number
  consistent: boolean
}

export type SelectionRequest = {
  start: number
  end: number
  from_summary: boolean
}

export type SectionResponseSlice = {
  score: number
  offset: number
  len: number
  to_doc: boolean
}

export type SectionResponse = SectionResponseSlice[]

export function userSectionResponse(start: number, end: number, toDoc: boolean): SectionResponseSlice {
  return {
    score: 2,
    offset: start,
    len: end - start,
    to_doc: toDoc,
  }
}

export type Error = {
  error: string
}

export type Normal = {
  message: string
}

export type LabelData = {
  record_id: string
  sample_id: string
  summary_start: number
  summary_end: number
  source_start: number
  source_end: number
  consistent: boolean
  task_index: number
  user_id: string
}
