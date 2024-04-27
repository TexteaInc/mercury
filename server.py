from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
import vectara
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

# VECTARA_CORPUS_ID = int(os.environ.get("VECTARA_CORPUS_ID"))

source_id, summary_id, tasks = get_full_documents()

class Label(BaseModel):
    sup: int
    sbottom: int
    dup: int
    dbottom: int
    correct: bool

class Selection(BaseModel):
    up: int
    bottom: int
    from_summary: bool

@app.get("/task")
async def get_tasks_length():
    return { "all": len(tasks) }

@app.get("/task/{task_index}")
async def get_task(task_index: int = 0):
    if task_index >= len(tasks):
        return {
            "error": "Invalid task index"
        }
    task = tasks[task_index]
    return {
        "doc": task["source"],
        "sum": task["summary"]
    }

now_task_index = -1

@app.post("/task/{task_index}")
async def post_task(task_index: int, label: Label):
    print(label)
    return {
        "message": "success"
    }
    
@app.post("/task/{task_index}/select")
async def post_selections(task_index: int, selection: Selection):
    if task_index >= len(tasks):
        return {
            "error": "Invalid task index"
        }
    if task_index < 0:
        return {
            "error": "Invalid task index"
        }
    use_id = source_id if selection.from_summary else summary_id
    query = tasks[task_index]["source"][selection.up:selection.bottom] if not selection.from_summary else tasks[task_index]["summary"][selection.up:selection.bottom]
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
        selections.append({
            "score": score,
            "offset": offset,
            "len": length,
            "to_doc": selection.from_summary,
        })
    return selections

app.mount("/", StaticFiles(directory="dist", html=True), name="dist")

if __name__ == "__main__":
    uvicorn.run(app, port=8000)
