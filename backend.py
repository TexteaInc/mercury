from fastapi import FastAPI
from pydantic import BaseModel
import requests
import io
import json
from fastapi.middleware.cors import CORSMiddleware
import os
import jsonlines

with open("./config.json", "r") as f:
    config = json.load(f)

DATASET_PATH = config["dataset"]

def load_jsonl(path):
    data = []
    with open(path, "r+", encoding="utf-8") as f:
        for item in jsonlines.Reader(f):
            data.append(item)
    return data

def load_ragtruth():
    response = load_jsonl(os.path.join(DATASET_PATH, "response.jsonl"))
    source_info = load_jsonl(os.path.join(DATASET_PATH, "source_info.jsonl"))
    source_info = { item["source_id"]:item for item in source_info }
    
    data = []
    for line in response:
        source = source_info[line["source_id"]]
        if source["task_type"] != "Summary":
            continue
        data.append({
            "doc": source["source_info"],
            "sum": line["response"],
        })
    return data

app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


VECTARA_CUSTOMER_ID = int(os.environ.get("VECTARA_CUSTOMER_ID"))
VECTARA_API_KEY = os.environ.get("VECTARA_API_KEY")
VECTARA_CORPUS_ID = int(os.environ.get("VECTARA_CORPUS_ID"))

tasks = load_ragtruth()

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

@app.get("/")
async def get_tasks_length():
    return { "all": len(tasks) }

@app.get("/{task_index}")
async def get_task(task_index: int = 0):
    if task_index >= len(tasks):
        return {
            "error": "Invalid task index"
        }
    return tasks[task_index]

now_task_index = -1

@app.post("/{task_index}")
async def post_task(task_index: int, label: Label):
    print(label)
    return {
        "message": "success"
    }
    
@app.post("/{task_index}/select")
async def post_selections(task_index: int, selection: Selection):
    global now_task_index
    if task_index >= len(tasks):
        return {
            "error": "Invalid task index"
        }
    if task_index < 0:
        return {
            "error": "Invalid task index"
        }
    if task_index != now_task_index:
        requests.post("https://api.vectara.io/v1/reset-corpus", data={
            "customer_id": VECTARA_CUSTOMER_ID,
            "corpus_id": VECTARA_CORPUS_ID,
        }, headers={
            "x-api-key": VECTARA_API_KEY,
            "customer-id": str(VECTARA_CUSTOMER_ID),
        })
        requests.post(f"https://api.vectara.io/v1/upload?c={VECTARA_CUSTOMER_ID}&o={VECTARA_CORPUS_ID}",
            headers={
                "x-api-key": VECTARA_API_KEY,
                "customer-id": str(VECTARA_CUSTOMER_ID),
            }, files=[
                ("file", ("doc", io.BytesIO(tasks[task_index]["doc"].encode("utf-8")), "application/octet-stream"))
            ])
        requests.post(f"https://api.vectara.io/v1/upload?c={VECTARA_CUSTOMER_ID}&o={VECTARA_CORPUS_ID}",
            headers={
                "x-api-key": VECTARA_API_KEY,
                "customer-id": str(VECTARA_CUSTOMER_ID),
            }, files=[
                ("file", ("sum", io.BytesIO(tasks[task_index]["sum"].encode("utf-8")), "application/octet-stream"))
            ])
        now_task_index = task_index
    query = tasks[task_index]["doc"][selection.up:selection.bottom] if not selection.from_summary else tasks[task_index]["sum"][selection.up:selection.bottom]
    response = requests.post("https://api.vectara.io/v1/query", headers={
        "customer-id": str(VECTARA_CUSTOMER_ID),
        "x-api-key": VECTARA_API_KEY,
    }, data=json.dumps(
        {
            "query": [
                {
                    "query": query,
                    "numResults": 5,
                    "corpusKey": [
                        {
                            "corpusId": VECTARA_CORPUS_ID,
                        }
                    ]
                }
            ]
        }
    ))
    selections = []
    documentIndex = 0 if selection.from_summary else 1
    for i in response.json()["responseSet"][0]["response"]:
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
