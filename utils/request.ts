import type { AllTasksLength, LabelRequest, Normal, SectionResponse, SelectionRequest, Task } from "./types"

const getAllTasksLength = (backend: string): Promise<AllTasksLength> => {
  return fetch(`${backend}/`)
    .then(response => response.json())
    .then(data => {
      return data as AllTasksLength
    })
}

const getSingleTask = (backend: string, taskIndex: number): Promise<Task | Error> => {
  return fetch(`${backend}/${taskIndex}`)
    .then(response => response.json())
    .then(data => {
      return data as Task | Error
    })
}

const selectText = (backend: string, taskIndex: number, req: SelectionRequest): Promise<SectionResponse | Error> => {
  return fetch(`${backend}/${taskIndex}/select`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  })
    .then(response => response.json())
    .then(data => {
      return data as SectionResponse | Error
    })
}

const labelText = (backend: string, taskIndex: number, req: LabelRequest): Promise<Normal> => {
  return fetch(`${backend}/${taskIndex}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  })
    .then(response => response.json())
    .then(data => {
      return data as Normal
    })
}

export { getAllTasksLength, getSingleTask, selectText, labelText }
