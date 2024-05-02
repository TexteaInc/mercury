import uuid
from typing import Annotated

import uvicorn
import vectara
from dotenv import load_dotenv
from fastapi import FastAPI, Header
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

from database import Database
from getter import get_full_documents

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
client = vectara.vectara()
database = Database()


source_id, summary_id, tasks = get_full_documents()


class Label(BaseModel):
    summary_start: int
    summary_end: int
    source_start: int
    source_end: int
    consistent: bool


class Selection(BaseModel):
    start: int
    end: int
    from_summary: bool


@app.get("/user/new")
async def create_new_user():
    return {"key": uuid.uuid4().hex}


@app.get("/user/export")
async def export_user_data(user_key: Annotated[str, Header()]):
    if user_key.startswith("\"") and user_key.endswith("\""):
        user_key = user_key[1:-1]
    return database.export_user_data(user_key)


@app.get("/task")
async def get_tasks_length():
    return {"all": len(tasks)}


@app.get("/task/{task_index}")
async def get_task(task_index: int = 0):
    if task_index >= len(tasks):
        return {"error": "Invalid task index"}
    task = tasks[task_index]
    return {"doc": task["source"], "sum": task["summary"]}


@app.post("/task/{task_index}/label")
async def post_task(task_index: int, label: Label, user_key: Annotated[str, Header()]):
    if user_key.startswith("\"") and user_key.endswith("\""):
        user_key = user_key[1:-1]
    database.push_new_document(
        {
            "task_id": tasks[task_index]["_id"],
            "summary_start": label.summary_start,
            "summary_end": label.summary_end,
            "source_start": label.source_start,
            "source_end": label.source_end,
            "consistent": label.consistent,
            "user_id": user_key,
        }
    )
    return {"message": "success"}


@app.post("/task/{task_index}/select")
async def post_selections(task_index: int, selection: Selection):
    if task_index >= len(tasks):
        return {"error": "Invalid task index"}
    if task_index < 0:
        return {"error": "Invalid task index"}
    use_id = source_id if selection.from_summary else summary_id
    query = (
        tasks[task_index]["source"][selection.start : selection.end]
        if not selection.from_summary
        else tasks[task_index]["summary"][selection.start : selection.end]
    )
    id_ = tasks[task_index]["_id"]
    response = client.query(
        corpus_id=use_id,
        query=query,
        top_k=5,
        lang="auto",
        metadata_filter=f"doc.id = '{id_}'",
        return_summary=False,
    )
    selections = []
    for i in response["responseSet"][0]["response"]:
        score = i["score"]
        offset = -1
        length = -1
        true_offset = 0
        for j in i["metadata"]:
            if j["name"] == "true_offset":
                true_offset = int(j["value"])
        offset = i["resultOffset"] + true_offset
        length = i["resultLength"]
        selections.append(
            {
                "score": score,
                "offset": offset,
                "len": length,
                "to_doc": selection.from_summary,
            }
        )
    return selections


app.mount("/", StaticFiles(directory="dist", html=True), name="dist")

if __name__ == "__main__":
    uvicorn.run(app, port=8000)
