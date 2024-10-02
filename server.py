import json
import os
import sys
import uuid
from typing import Annotated
import struct

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Header
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List

load_dotenv()

# from better_vectara import BetterVectara as Vectara
from database import Database, LabelData
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse

import yaml
import sqlite3
import sqlite_vec
from ingester import Embedder
from database import Database

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# vectara_client = Vectara()

def serialize_f32(vector: List[float]) -> bytes:
    """serializes a list of floats into a compact "raw bytes" format"""
    return struct.pack("%sf" % len(vector), *vector)

class Label(BaseModel):
    summary_start: int
    summary_end: int
    source_start: int
    source_end: int
    consistent: list[str]
    note: str

class Selection(BaseModel):
    start: int
    end: int
    from_summary: bool

class Name(BaseModel):
    name: str

@app.get("/candidate_labels") 
async def get_labels() -> list: # get all candidate labels for human annotators to choose from
    with open("labels.yaml") as f:
        labels = yaml.safe_load(f)
    return labels

@app.get("/user/new") # please update the route name to be more meaningful, e.g., /user/new_user
async def create_new_user():
    user_id = uuid.uuid4().hex
    user_name = "New User"
    database.add_user(user_id, user_name)
    return {"key": user_id, "name": user_name}

@app.post("/user/name")
async def update_user_name(name: Name, user_key: Annotated[str, Header()]):
    if user_key.startswith('"') and user_key.endswith('"'):
        user_key = user_key[1:-1]
    database.change_user_name(user_key, name.name)
    return {"message": "success"}

@app.get("/user/me")
async def get_user_name(user_key: Annotated[str, Header()]):
    if user_key.startswith('"') and user_key.endswith('"'):
        user_key = user_key[1:-1]
    username = database.get_user_name(user_key)
    if username is None:
        return {"error": "User not found"}
    else:
        return {"name": username}

@app.get("/user/export") # please update the route name to be more meaningful, e.g., /user/export_user_data
async def export_user_data(user_key: Annotated[str, Header()]):
    if user_key.startswith('"') and user_key.endswith('"'):
        user_key = user_key[1:-1]
    return database.dump_annotator_labels(user_key)


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

    # label_data = LabelData(
    #     record_id="not assigned",
    #     sample_id=tasks[task_index]["_id"],
    #     summary_start=label.summary_start,
    #     summary_end=label.summary_end,
    #     source_start=label.source_start,
    #     source_end=label.source_end,
    #     consistent=label.consistent,
    #     task_index=task_index,
    #     user_id=user_key,
    # )
    
    sample_id = task_index
    annot_spans = {}
    if label.summary_start != -1:
        annot_spans["summary"] = (label.summary_start, label.summary_end)
    if label.source_start != -1:
        annot_spans["source"] = (label.source_start, label.source_end)
    
    annotator = user_key
    
    label_string = json.dumps(label.consistent)
    
    database.push_annotation({
        "sample_id": sample_id,
        "annotator": annotator,
        "label": label_string,
        "annot_spans": annot_spans,
        "note": label.note
    }) # the label_data is in databse.OldLabelData format
    return {"message": "success"}


@app.post("/task/{task_index}/select") # TODO: to be updated by Forrest using openAI's API or local model to embed text on the fly
async def post_selections(task_index: int, selection: Selection):
    if task_index >= len(tasks):
        return {"error": "Invalid task index"}
    if task_index < 0:
        return {"error": "Invalid task index"}
    # use_id = source_corpus_id if selection.from_summary else summary_corpus_id
    query = (
        tasks[task_index]["source"][selection.start : selection.end]
        if not selection.from_summary
        else tasks[task_index]["summary"][selection.start : selection.end]
    )
    id_ = tasks[task_index]["_id"]

    # response = vectara_client.query(
    #     corpus_id=use_id,
    #     query=query,
    #     top_k=5,
    #     # TODO: Please all users to select k value via a sliding bar
    #     lang="auto",
    #     metadata_filter=f"doc.id = '{id_}'",
    #     do_generation=False,
    # )

    # first embedd query 
    embedding = embedder.embed([query], embedding_dimension=configs["embedding_dimension"])[0]
    
    # Then get the chunk_id's from the opposite document
    sql_cmd = "SELECT chunk_id, text FROM chunks WHERE text_type = ? AND sample_id = ?"
    if selection.from_summary:
        text_type = "source"
    else:
        text_type = "summary"

    chunk_id_and_text = database.db.execute(sql_cmd, [text_type, task_index]).fetchall()
    search_chunk_ids = [row[0] for row in chunk_id_and_text]
    vecter_db_row_ids = [str(x+1) for x in search_chunk_ids] # rowid starts from 1 while chunk_id starts from 0

    if len(search_chunk_ids) == 1: # no need for vector search
        selections = [{
            "score": 1.0,
            "offset": 0,
            "len": len(chunk_id_and_text[0][1]),
            "to_doc": selection.from_summary,
        }]
        return selections

    # Do vector search on the `embeddings` table when rowid is in chunk_ids
    # print ("Search for row ids: ", search_chunk_ids)
    # print ("Embedding: ", embedding)    
    sql_cmd = " \
        SELECT  \
            rowid, \
            distance \
        FROM embeddings "  \
        " WHERE rowid IN ({0})" \
        "AND embedding MATCH '{1}'  \
        ORDER BY distance \
        LIMIT 5;".format(', '.join(vecter_db_row_ids), embedding)
    # print ("SQL_CMD", sql_cmd)
    
    # vector_search_result = database.db.execute(sql_cmd, [*search_chunk_ids, serialize_f32(embedding)]).fetchall()
    vector_search_result = database.db.execute(sql_cmd).fetchall()
    # [(2, 0.20000001788139343), (1, 0.40000003576278687)]
    # turn this into a dict from chunk__id to distance/score
    chunk_id_to_score = {row[0]: row[1] for row in vector_search_result}
    chunk_ids_of_top_k = [row[0] for row in vector_search_result]

    # get the char_offset and len from the chunks table based on the chunk_ids
    sql_cmd = "SELECT chunk_id, text, char_offset FROM chunks WHERE chunk_id in ({0});".format(', '.join('?' for _ in chunk_ids_of_top_k))
    search_chunk_ids = [row[0] for row in vector_search_result]
    response = database.db.execute(sql_cmd, search_chunk_ids).fetchall()
    # [(1, 'This is a test.', 0, 14), (2, 'This is a test.', 15, 14)]

    # organize into a dict of keys "score", "offset", "len", "to_doc"
    # and append to a list of selections
    selections = []
    for i in response:
        score = chunk_id_to_score[i[0]]
        offset = i[2]
        text = i[1]
        selections.append(
            {
                "score": 1 - score, # semantic similarity is 1 - distance
                "offset": offset,
                "len": len(text),
                "to_doc": selection.from_summary,
            }
        )

    # then return the response

    # selections = []
    # for i in response["responseSet"][0]["response"]:
    #     score = i["score"]
    #     true_offset = 0
    #     for j in i["metadata"]:
    #         if j["name"] == "true_offset":
    #             true_offset = int(j["value"])
    #     offset = i["resultOffset"] + true_offset
    #     length = i["resultLength"]
    #     selections.append(
    #         {
    #             "score": score,
    #             "offset": offset,
    #             "len": length,
    #             "to_doc": selection.from_summary,
    #         }
    #     )
    return selections


@app.delete("/record/{record_id}")
async def delete_annotation(record_id: str, user_key: Annotated[str, Header()]):
    if user_key.startswith('"') and user_key.endswith('"'):
        user_key = user_key[1:-1]
    database.delete_annotation(record_id, user_key)
    return {"message": f"delete anntation {record_id} success"}


@app.get("/history")  # redirect route to history.html
async def history():
    return FileResponse("dist/history.html")

@app.get("/viewer")
async def viewer():
    return FileResponse("dist/viewer.html")

if __name__ == "__main__":

    app.mount("/", StaticFiles(directory="dist", html=True), name="dist")

    import argparse

    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("--sqlite_db", type=str, default="./mercury.sqlite")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    print ("Using sqlite db: ", args.sqlite_db)

    database = Database(args.sqlite_db)

    # TODO: the name 'tasks' can be misleading. It should be changed to something more descriptive.
    tasks = database.fetch_data_for_labeling()
    configs = database.fetch_configs()
    embedder = Embedder(configs["embedding_model_id"])

    uvicorn.run(app, port=args.port, host="0.0.0.0")
