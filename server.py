import os
import sys
import uuid
from typing import Annotated

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Header
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

from better_vectara import BetterVectara as Vectara
from database import Database, LabelData
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse

import sqlite3
import sqlite_vec

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
vectara_client = Vectara()


##### Prepare corpus IDs #####
try:
    source_corpus_id = int(os.environ["SOURCE_CORPUS_ID"])
except KeyError:
    source_corpus_id = int(
        input(
            "No source corpus ID found in .env file. Please provide a source corpus id: "
        )
    )

try:
    summary_corpus_id = int(os.environ["SUMMARY_CORPUS_ID"])
except KeyError:
    summary_corpus_id = int(
        input(
            "No summary corpus ID found in .env file. Please provide a summary corpus id: "
        )
    )

try:
    annotation_corpus_id = int(os.environ["ANNOTATION_CORPUS_ID"])
except KeyError:
    annotation_corpus_id = int(
        input(
            "No annotation corpus ID found in .env file. Please provide an annotation corpus id: "
        )
    )
##### End of preparing corpus IDs #####

database = Database(annotation_corpus_id)




def fetch_data_for_labeling(source_corpus_id, summary_corpus_id):
    """Fetch the source-summary pairs for labeling from Vectara server."""
    data_for_labeling = {}
    for doc_type in ["source", "summary"]:
        corpus_id = source_corpus_id if doc_type == "source" else summary_corpus_id
        for doc in vectara_client.list_all_documents(corpus_id):
            id_ = doc["id"]
            for metadata in doc["metadata"]:
                if metadata["name"] == "text":
                    text = metadata["value"]
            data_for_labeling.setdefault(id_, {})[doc_type] = text

    data_for_labeling = [{"_id": k, **v} for k, v in data_for_labeling.items()]
    data_for_labeling.sort(key=lambda x: int(x["_id"].split("_")[1]))
    return data_for_labeling


tasks = fetch_data_for_labeling(source_corpus_id, summary_corpus_id)
# TODO: the name 'tasks' can be misleading. It should be changed to something more descriptive.

# TODO: pass the sqlite_db_path from CMD
def fetch_data_for_labeling(sqlite_db_path: str= "./mercury.sqlite"): 
    """Fetch the source-summary pairs for labeling from the database."""

    data_for_labeling = {}
    sectioned_chunks = {} 
    db = sqlite3.connect(sqlite_db_path)
    texts = db.execute("SELECT text, text_type, sample_id, chunk_offset FROM chunks").fetchall()
    """ texts = 
    [('The quick brown fox.', 'source', 1, 0),
    ('Jumps over a lazy dog.', 'source', 1, 1),
    ('We the people.', 'source', 2, 0),
    ('Of the U.S.A.', 'source', 2, 1),
    ('26 letters.', 'summary', 1, 0),
    ('The U.S. Constitution.', 'summary', 2, 0),
    ('It is great.', 'summary', 2, 1)]
    """
    for text, text_type, sample_id, chunk_offset in texts:
        sectioned_chunks.setdefault(sample_id, {}).setdefault(text_type, {})[chunk_offset] = text
        # levels: sample_id -> text_type -> chunk_offset -> text

    # sort chunks by chunk_offset as dictionary 
    for sample_id in sectioned_chunks:
        for text_type in sectioned_chunks[sample_id]:
            sectioned_chunks[sample_id][text_type] = dict(sorted(sectioned_chunks[sample_id][text_type].items()))

    """ sectioned_chunks =
    {
        1: {
            'source': {
                0: 'The quick brown fox.',
                1: 'Jumps over a lazy dog.'
            }, 
            'summary': {
                0: '26 letters.'
            }
        },
        2: {
            'source': {
                0: 'We the people.',
                1: 'Of the U.S.A.'
            }, 
            'summary': {
                0: 'The U.S. Constitution.',
                1: 'It is great.'
            }
        }
    """

    data_for_labeling = [
        {
            "_id": str(sample_id), 
            "source": " ".join(sectioned_chunks[sample_id]["source"].values()),
            "summary": " ".join(sectioned_chunks[sample_id]["summary"].values())
        }
        for sample_id in sectioned_chunks
    ]

    """ data_for_labeling =
    [
        {
            '_id': '1',
            'source': 'The quick brown fox. Jumps over a lazy dog.',
            'summary': '26 letters.'
        },
        {
            '_id': '2',
            'source': 'We the people. Of the U.S.A.',
            'summary': 'The U.S. Constitution. It is great.'
        }
    ]
    """

    # sort data_for_labeling by sample_id
    data_for_labeling.sort(key=lambda x: int(x["_id"]))

    return data_for_labeling

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
    if user_key.startswith('"') and user_key.endswith('"'):
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


@app.get("/task/{task_index}/history")
async def get_task_history(task_index: int, user_key: Annotated[str, Header()]):
    if user_key.startswith('"') and user_key.endswith('"'):
        user_key = user_key[1:-1]
    return database.export_task_history(task_index, user_key)


@app.post("/task/{task_index}/label")
async def post_task(task_index: int, label: Label, user_key: Annotated[str, Header()]):
    if user_key.startswith('"') and user_key.endswith('"'):
        user_key = user_key[1:-1]

    label_data = LabelData(
        record_id="not assigned",
        sample_id=tasks[task_index]["_id"],
        summary_start=label.summary_start,
        summary_end=label.summary_end,
        source_start=label.source_start,
        source_end=label.source_end,
        consistent=label.consistent,
        task_index=task_index,
        user_id=user_key,
    )
    database.push_annotation(label_data)
    return {"message": "success"}


@app.post("/task/{task_index}/select")
async def post_selections(task_index: int, selection: Selection):
    if task_index >= len(tasks):
        return {"error": "Invalid task index"}
    if task_index < 0:
        return {"error": "Invalid task index"}
    use_id = source_corpus_id if selection.from_summary else summary_corpus_id
    query = (
        tasks[task_index]["source"][selection.start : selection.end]
        if not selection.from_summary
        else tasks[task_index]["summary"][selection.start : selection.end]
    )
    id_ = tasks[task_index]["_id"]
    response = vectara_client.query(
        corpus_id=use_id,
        query=query,
        top_k=5,
        # TODO: Please all users to select k value via a sliding bar
        lang="auto",
        metadata_filter=f"doc.id = '{id_}'",
        do_generation=False,
    )
    selections = []
    for i in response["responseSet"][0]["response"]:
        score = i["score"]
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


@app.delete("/record/{record_id}")
async def delete_annotation(record_id: str, user_key: Annotated[str, Header()]):
    database.delete_annotation(record_id, user_key)
    return {"message": "success"}


@app.get("/history")  # redirect route to history.html
async def history():
    return FileResponse("dist/history.html")


if __name__ == "__main__":
    app.mount("/", StaticFiles(directory="dist", html=True), name="dist")
    uvicorn.run(app, port=8000)
