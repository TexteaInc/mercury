import type {
  AllTasksLength,
  Comment,
  CommentData,
  LabelData,
  LabelRequest,
  Normal,
  RequestError,
  SectionResponse,
  SelectionRequest,
  Task,
  User,
} from "./types"

const backend = process.env.NEXT_PUBLIC_BACKEND || ""

async function getUserMe(access_token: string): Promise<User> {
  const response = await fetch(`${backend}/user/me`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  })
  return response.json()
}

async function checkUserMe(access_token: string): Promise<boolean> {
  const response = await fetch(`${backend}/user/me`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  })
  return response.ok
}

async function changeName(access_token: string, name: string): Promise<Normal> {
  const response = await fetch(`${backend}/user/name`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${access_token}`,
    },
    body: JSON.stringify({ name }),
  })
  const data = await response.json()
  return data as Normal
}

async function getAllLabels(): Promise<(string | object)[]> {
  const response = await fetch(`${backend}/candidate_labels`)
  const data = await response.json()
  return data as string[]
}

async function getAllTitles(): Promise<string[]> {
  const response = await fetch(`${backend}/titles`)
  const data = await response.json()
  return data as string[]
}

async function getAllTasksLength(): Promise<AllTasksLength> {
  const response = await fetch(`${backend}/task`)
  const data = await response.json()
  return data as AllTasksLength
}

async function getSingleTask(taskIndex: number): Promise<Task | RequestError> {
  const response = await fetch(`${backend}/task/${taskIndex}`)
  const data = await response.json()
  return data as Task | RequestError
}

async function selectText(taskIndex: number, req: SelectionRequest): Promise<SectionResponse | RequestError> {
  const response = await fetch(`${backend}/task/${taskIndex}/select`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  })
  const data = await response.json()
  return data as SectionResponse | RequestError
}

async function labelText(access_token: string, taskIndex: number, req: LabelRequest): Promise<Normal> {
  const response = await fetch(`${backend}/task/${taskIndex}/label`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${access_token}`,
    },
    body: JSON.stringify(req),
  })
  const data = await response.json()
  return data as Normal
}

async function exportFullLabels(): Promise<LabelData[]> {
  const response = await fetch(`${backend}/labels`)
  const data = await response.json()
  return data as LabelData[]
}

async function exportLabel(access_token: string): Promise<LabelData[]> {
  const response = await fetch(`${backend}/user/export`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  })
  const data = await response.json()
  return data as LabelData[]
}

async function getTaskHistory(access_token: string, taskIndex: number): Promise<LabelData[]> {
  const response = await fetch(`${backend}/task/${taskIndex}/history`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  })
  const data = await response.json()
  if (Array.isArray(data)) {
    return data as LabelData[]
  }
  return []
}

async function deleteLabel(access_token: string, recordId: number): Promise<Normal> {
  const response = await fetch(`${backend}/record/${recordId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  })
  const data = await response.json()
  return data as Normal
}

async function login(email: string, password: string): Promise<string | null> {
  const response = await fetch(`${backend}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ username: email, password }),
  })
  const data = await response.json()
  if ("access_token" in data) {
    return data.access_token
  }
  return null
}

async function patchLabel(access_token: string, taskIndex: number, recordId: number, labelData: LabelRequest): Promise<Normal> {
  const response = await fetch(`${backend}/task/${taskIndex}/label/${recordId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${access_token}`,
    },
    body: JSON.stringify(labelData),
  })
  const data = await response.json()
  return data as Normal
}

async function getComment(annotId: number) {
  const response = await fetch(`${backend}/annot/${annotId}/comments`)
  const data = await response.json()
  return data as Comment[]
}

async function commitComment(access_token: string, comment: CommentData) {
  const response = await fetch(`${backend}/annot/${comment.annot_id}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${access_token}`,
    },
    body: JSON.stringify(comment),
  })
  const data = await response.json()
  return data as Normal
}

async function patchComment(access_token: string, id: number, comment: CommentData) {
  const response = await fetch(`${backend}/annot/${comment.annot_id}/comments/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${access_token}`,
    },
    body: JSON.stringify(comment),
  })
  const data = await response.json()
  return data as Normal
}

async function deleteComment(access_token: string, id: number, annotId: number) {
  const response = await fetch(`${backend}/annot/${annotId}/comments/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  })
  const data = await response.json()
  return data as Normal
}

export {
  changeName,
  checkUserMe,
  commitComment,
  deleteComment,
  deleteLabel,
  exportFullLabels,
  exportLabel,
  getAllLabels,
  getAllTasksLength,
  getAllTitles,
  getComment,
  getSingleTask,
  getTaskHistory,
  getUserMe,
  labelText,
  login,
  patchComment,
  patchLabel,
  selectText,
}
