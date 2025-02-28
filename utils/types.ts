export interface Task {
  doc: string
  sum: string
}

export interface AllTasksLength {
  all: number
}

export interface LabelRequest {
  summary_start: number
  summary_end: number
  source_start: number
  source_end: number
  consistent: string[]
  note: string
}

export interface SelectionRequest {
  start: number
  end: number
  from_summary: boolean
}

export interface SectionResponseSlice {
  score: number
  offset: number
  len: number
  to_doc: boolean
}

export type SectionResponse = SectionResponseSlice[]

export interface ServerSection {
  score: number
  offset: number
  len: number
  to_doc: boolean
  index: number
}

export function userSectionResponse(start: number, end: number, toDoc: boolean): SectionResponseSlice {
  return {
    score: 2,
    offset: start,
    len: end - start,
    to_doc: toDoc,
  }
}

export function mixedToBoolean(checked: "mixed" | boolean): boolean {
  if (checked === "mixed") {
    return true
  }
  return checked
}

export interface RequestError {
  error: string
}

export function isRequestError(obj: any): obj is RequestError {
  return typeof obj.error === "string"
}

export function handleRequestError(e: RequestError) {
  throw new Error(e.error)
}

export interface Normal {
  message: string
}

export interface LabelData {
  record_id: number
  sample_id: string
  summary_start: number
  summary_end: number
  source_start: number
  source_end: number
  consistent: string[]
  task_index: number
  user_id: string
  note: string
  username?: string
}

export interface User {
  id: string
  name: string
  email: string
}

export interface Comment {
  comment_id: number
  user_id: string
  username: string
  annot_id: number
  parent_id: number | null
  text: string
  comment_time: string
}

export interface CommentData {
  annot_id: number
  parent_id: number | null
  text: string
}

export function isNumber(value: unknown) {
  return typeof value === "number" && !Number.isNaN(value)
}

export function isSafeNumber(value: unknown) {
  return isNumber(value) ? (value as number) >= 0 : false
}

export interface HighlightMeta {
  start: number
  end: number
  color: string
}
