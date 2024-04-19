from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
import vectara
from ingester import read_file_into_corpus

load_dotenv()



app = FastAPI()
client = vectara.vectara()

# VECTARA_CORPUS_ID = int(os.environ.get("VECTARA_CORPUS_ID"))

source_id, summary_id, tasks = read_file_into_corpus()

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
    use_id = source_id if not selection.from_summary else summary_id
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
    documentIndex = 0 if selection.from_summary else 1
    for i in response["responseSet"][0]["response"]:
        if documentIndex == i["documentIndex"]:
            score = i["score"]
            offset = -1
            length = -1
            for j in i["metadata"]:
                if j["name"] == "offset":
                    offset = int(j["value"])
                if j["name"] == "len":
                    length = int(j["value"])
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
