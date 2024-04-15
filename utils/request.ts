import type { AllTasksLength, LabelRequest, Normal, SectionResponse, SelectionRequest, Task } from "./types"

const getAllTasksLength = (): Promise<AllTasksLength> => {
  return fetch("/task")
    .then(response => response.json())
    .then(data => {
      return data as AllTasksLength
    })
}

const getSingleTask = (taskIndex: number): Promise<Task | Error> => {
  return fetch(`/task/${taskIndex}`)
    .then(response => response.json())
    .then(data => {
      return data as Task | Error
    })
}

const selectText = (taskIndex: number, req: SelectionRequest): Promise<SectionResponse | Error> => {
  return fetch(`/task/${taskIndex}/select`, {
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

const labelText = (taskIndex: number, req: LabelRequest): Promise<Normal> => {
  return fetch(`/task/${taskIndex}`, {
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
