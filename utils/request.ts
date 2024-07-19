import type { AllTasksLength, LabelData, LabelRequest, Normal, SectionResponse, SelectionRequest, Task } from "./types"

const backend = process.env.NEXT_PUBLIC_BACKEND || "";

const getKey = (): Promise<string> => {
  const key = localStorage.getItem("key")
  if (key === "" || key === null) {
    return fetch(`${backend}/user/new`)
      .then(response => response.json())
      .then(data => {
        localStorage.setItem("key", data.key)
        return data.key
      })
  }
  return Promise.resolve(key)
}

const getAllTasksLength = (): Promise<AllTasksLength> => {
  return fetch(`${backend}/task`)
    .then(response => response.json())
    .then(data => {
      return data as AllTasksLength
    })
}

const getSingleTask = (taskIndex: number): Promise<Task | Error> => {
  return fetch(`${backend}/task/${taskIndex}`)
    .then(response => response.json())
    .then(data => {
      return data as Task | Error
    })
}

const selectText = (taskIndex: number, req: SelectionRequest): Promise<SectionResponse | Error> => {
  return fetch(`${backend}/task/${taskIndex}/select`, {
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
  return getKey().then(key => {
    return fetch(`${backend}/task/${taskIndex}/label`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Key": key,
      },
      body: JSON.stringify(req),
    })
      .then(response => response.json())
      .then(data => {
        return data as Normal
      })
  })
}

const exportLabel = (): Promise<LabelData[]> => {
  return getKey().then(key => {
    return fetch(`${backend}/user/export`, {
      headers: {
        "User-Key": key,
      },
    })
      .then(response => response.json())
      .then(data => {
        return data as LabelData[]
      })
  })
}

export { getAllTasksLength, getSingleTask, selectText, labelText, exportLabel }
