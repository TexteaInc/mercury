import type {
  AllTasksLength,
  LabelData,
  LabelRequest,
  Normal,
  SectionResponse,
  SelectionRequest,
  Task,
} from "./types";

const backend = process.env.NEXT_PUBLIC_BACKEND || "";

const getKey = async (): Promise<string> => {
  const key = localStorage.getItem("key");
  if (key === "" || key === null) {
    const response = await fetch(`${backend}/user/new`);
    const data = await response.json();
    localStorage.setItem("key", data.key);
    return data.key;
  }
  return Promise.resolve(key);
};

const getAllTasksLength = async (): Promise<AllTasksLength> => {
  const response = await fetch(`${backend}/task`);
  const data = await response.json();
  return data as AllTasksLength;
};

const getSingleTask = async (taskIndex: number): Promise<Task | Error> => {
  const response = await fetch(`${backend}/task/${taskIndex}`);
  const data = await response.json();
  return data as Task | Error;
};

const selectText = async (
  taskIndex: number,
  req: SelectionRequest,
): Promise<SectionResponse | Error> => {
  const response = await fetch(`${backend}/task/${taskIndex}/select`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });
  const data = await response.json();
  return data as SectionResponse | Error;
};

const labelText = async (
  taskIndex: number,
  req: LabelRequest,
): Promise<Normal> => {
  const key = await getKey();
  const response = await fetch(`${backend}/task/${taskIndex}/label`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Key": key,
    },
    body: JSON.stringify(req),
  });
  const data = await response.json();
  return data as Normal;
};

const exportLabel = async (): Promise<LabelData[]> => {
  const key = await getKey();
  const response = await fetch(`${backend}/user/export`, {
    headers: {
      "User-Key": key,
    },
  });
  const data = await response.json();
  return data as LabelData[];
};

const getTaskHistory = async (taskIndex: number): Promise<LabelData[]> => {
  const key = await getKey();
  const response = await fetch(`${backend}/task/${taskIndex}/history`, {
    headers: {
      "User-Key": key,
    },
  });
  const data = await response.json();
  return data as LabelData[];
};

const deleteRecord = async (recordId: string): Promise<Normal> => {
  const key = await getKey();
  const response = await fetch(`${backend}/record/${recordId}`, {
    method: "DELETE",
    headers: {
      "User-Key": key,
    },
  });
  const data = await response.json();
  return data as Normal;
};

export {
  getAllTasksLength,
  getSingleTask,
  selectText,
  labelText,
  exportLabel,
  getTaskHistory,
  deleteRecord,
};
