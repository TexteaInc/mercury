import json
import os
import sys
import uuid
from functools import lru_cache
from typing import Annotated
import struct

import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
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
from version import __version__

import jwt
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timedelta, timezone

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


class Token(BaseModel):
    access_token: str
    token_type: str


class User(BaseModel):
    id: str
    name: str
    email: str


class Comment(BaseModel):
    comment_id: int
    user_id: str
    username: str
    annot_id: int
    parent_id: int | None
    text: str
    comment_time: str


class CommentData(BaseModel):
    annot_id: int
    parent_id: int | None
    text: str


@lru_cache
class Config(BaseModel):
    secret_key: str
    expire: int


def get_config():
    raise NotImplementedError("This should be overridden.")


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def create_access_token(data: dict, secret_key: str, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm="HS256")
    return encoded_jwt


@app.post("/login")
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
                config: Config = Depends(get_config)) -> Token:
    auth_success, user_id = database.auth_user(form_data.username,
                                               form_data.password)
    if not auth_success:  # username here is actually email, since OAuth2 requires key be username
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect username or password",
                            headers={"WWW-Authenticate": "Bearer"})
    access_token_expires = timedelta(minutes=config.expire)
    access_token = create_access_token({"user_id": user_id}, config.secret_key, access_token_expires)
    return Token(access_token=access_token, token_type="bearer")


@app.get("/candidate_labels")
async def get_labels() -> list:  # get all candidate labels for human annotators to choose from
    with open("labels.yaml") as f:
        labels = yaml.safe_load(f)
    return labels


@app.get("/user/me")
async def get_user(token: Annotated[str, Depends(oauth2_scheme)], config: Config = Depends(get_config)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, config.secret_key, algorithms=["HS256"], verify=True)
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    user = database.get_user_by_id(user_id)
    if user is None:
        raise credentials_exception
    return User(id=user[0], name=user[1], email=user[2])


@app.post("/user/name")
async def update_user_name(name: Name, user: Annotated[User, Depends(get_user)]):
    database.change_user_name(user.id, name.name)
    return {"message": "success"}


@app.get("/user/export")  # please update the route name to be more meaningful, e.g., /user/export_user_data
async def export_user_data(user: Annotated[User, Depends(get_user)]):
    return database.dump_annotator_labels(user.id)


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
async def get_task_history(task_index: int, _: Annotated[User, Depends(get_user)]):
    return database.export_task_history(task_index)


@app.get("/task/{task_index}/other/annotations")
async def get_other_annotations(task_index: int, user: Annotated[User, Depends(get_user)]):
    return database.get_others_annotation(user.id, task_index)


@app.post("/task/{task_index}/label")
async def post_task(task_index: int, label: Label, user: Annotated[User, Depends(get_user)]):
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

    annotator = user.id

    label_string = json.dumps(label.consistent)

    database.push_annotation({
        "sample_id": sample_id,
        "annotator": annotator,
        "label": label_string,
        "annot_spans": annot_spans,
        "note": label.note
    })  # the label_data is in databse.OldLabelData format
    return {"message": "success"}


@app.patch("/task/{task_index}/label/{record_id}")
async def patch_task(task_index: int, record_id: int, label: Label, user: Annotated[User, Depends(get_user)]):
    sample_id = task_index
    annot_spans = {}
    if label.summary_start != -1:
        annot_spans["summary"] = (label.summary_start, label.summary_end)
    if label.source_start != -1:
        annot_spans["source"] = (label.source_start, label.source_end)

    annotator = user.id

    label_string = json.dumps(label.consistent)

    database.update_annotation({
        "record_id": record_id,
        "sample_id": sample_id,
        "annotator": annotator,
        "label": label_string,
        "annot_spans": annot_spans,
        "note": label.note
    })
    return {"message": "success"}


@app.post(
    "/task/{task_index}/select")  # TODO: to be updated by Forrest using openAI's API or local model to embed text on the fly
async def post_selections(task_index: int, selection: Selection):
    if task_index >= len(tasks):
        return {"error": "Invalid task index"}
    if task_index < 0:
        return {"error": "Invalid task index"}
    # use_id = source_corpus_id if selection.from_summary else summary_corpus_id
    query = (
        tasks[task_index]["source"][selection.start: selection.end]
        if not selection.from_summary
        else tasks[task_index]["summary"][selection.start: selection.end]
    )
    # id_ = tasks[task_index]["_id"]

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
    # sql_cmd = "SELECT chunk_id, text FROM chunks WHERE text_type = ? AND sample_id = ?"
    if selection.from_summary:
        text_type = "source"
    else:
        text_type = "summary"

    # chunk_id_and_text = database.mercury_db.execute(sql_cmd, [text_type, task_index]).fetchall()
    # search_chunk_ids = [row[0] for row in chunk_id_and_text]
    # vecter_db_row_ids = [str(x + 1) for x in search_chunk_ids]  # rowid starts from 1 while chunk_id starts from 0

    # if len(search_chunk_ids) == 1:  # no need for vector search
    #     selections = [{
    #         "score": 1.0,
    #         "offset": 0,
    #         "len": len(chunk_id_and_text[0][1]),
    #         "to_doc": selection.from_summary,
    #     }]
    #     return selections

    # Do vector search on the `embeddings` table when rowid is in chunk_ids
    # print ("Search for row ids: ", search_chunk_ids)
    # print ("Embedding: ", embedding)
    # sql_cmd = " \
    #     SELECT  \
    #         chunk_id, \
    #         distance \
    #     FROM chunks " \
    #           " WHERE chunk_id IN ({0})" \
    #           "AND embedding MATCH '{1}'  \
    #           ORDER BY distance \
    #           LIMIT 5;".format(', '.join(vecter_db_row_ids), embedding)
    sql_cmd = f"SELECT chunk_id, distance FROM chunks WHERE k =5 AND sample_id = {task_index} AND text_type = '{text_type}' AND embedding MATCH '{embedding}' ORDER BY distance"
    # print ("SQL_CMD", sql_cmd)

    # vector_search_result = database.db.execute(sql_cmd, [*search_chunk_ids, serialize_f32(embedding)]).fetchall()
    vector_search_result = database.mercury_db.execute(sql_cmd).fetchall()
    # [(2, 0.20000001788139343), (1, 0.40000003576278687)]
    # turn this into a dict from chunk__id to distance/score
    chunk_id_to_score = {row[0]: row[1] for row in vector_search_result}
    chunk_ids_of_top_k = [row[0] for row in vector_search_result]

    # get the char_offset and len from the chunks table based on the chunk_ids
    sql_cmd = "SELECT chunk_id, text, char_offset FROM chunks WHERE chunk_id in ({0});".format(
        ', '.join('?' for _ in chunk_ids_of_top_k))
    search_chunk_ids = [row[0] for row in vector_search_result]
    response = database.mercury_db.execute(sql_cmd, search_chunk_ids).fetchall()
    # [(1, 'This is a test.', 0), (2, 'This is a test.', 15)]

    # organize into a dict of keys "score", "offset", "len", "to_doc"
    # and append to a list of selections
    selections = []
    for i in response:
        score = chunk_id_to_score[i[0]]
        offset = i[2]
        text = i[1]
        selections.append(
            {
                "score": 1 - score,  # semantic similarity is 1 - distance
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


@app.get("/annot/{annot_index}/comments")
async def get_comments(annot_index: int):
    comments = database.get_annotation_comments(annot_index)
    comments_data = []
    usernames = {}
    for comment_id, user_id, annot_id, parent_id, text, comment_time in comments:
        if user_id not in usernames:
            username = database.get_user_name_without_lock(user_id)
            if username is not None:
                usernames[user_id] = username
            else:
                usernames[user_id] = "Unknown"
        comments_data.append({
            "comment_id": comment_id,
            "user_id": user_id,
            "username": usernames[user_id],
            "annot_id": annot_id,
            "parent_id": parent_id,
            "text": text,
            "comment_time": comment_time
        })
    return comments_data


@app.post("/annot/{annot_index}/comments")
async def post_comments(annot_index: int, comment: CommentData, user: Annotated[User, Depends(get_user)]):
    database.commit_comment(user.id, annot_index, comment.parent_id, comment.text)
    return {"message": "success"}


@app.delete("/annot/{annot_index}/comments/{comment_id}")
async def delete_comments(annot_index: int, comment_id: int, user: Annotated[User, Depends(get_user)]):
    comment = database.get_comment_by_id(comment_id)
    if comment[1] != user.id or comment[2] != annot_index:
        raise HTTPException(status_code=403)
    database.delete_comment(user.id, comment_id)
    return {"message": "success"}


@app.patch("/annot/{annot_index}/comments/{comment_id}")
async def patch_comments(annot_index: int, comment_id: int, comment: CommentData,
                         user: Annotated[User, Depends(get_user)]):
    target = database.get_comment_by_id(comment_id)
    if target[1] != user.id or target[2] != annot_index:
        raise HTTPException(status_code=403)
    database.edit_comment(user.id, comment_id, comment.text)
    return {"message": "success"}


@app.delete("/record/{record_id}")
async def delete_annotation(record_id: str, user: Annotated[User, Depends(get_user)]):
    database.delete_annotation(record_id, user.id)
    return {"message": f"delete anntation {record_id} success"}


@app.get("/labels")
async def get_labels():
    return database.dump_annotation(dump_file=None)


@app.get("/history")  # redirect route to history.html
async def history():
    return FileResponse("dist/history.html")


@app.get("/viewer")
async def viewer():
    return FileResponse("dist/viewer.html")


@app.get("/login")
async def login():
    return FileResponse("dist/login.html")


if __name__ == "__main__":
    app.mount("/", StaticFiles(directory="dist", html=True), name="dist")

    import argparse

    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("--mercury_db", type=str, required=True, default="./mercury.sqlite")
    parser.add_argument("--user_db", type=str, required=True, default="./user.sqlite")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--version", action="version", version="__version__")
    args = parser.parse_args()

    env_secret_key = os.getenv("SECRET_KEY")
    if env_secret_key is None:
        print("SECRET_KEY is not set in the environment")
        exit(1)
    expire = int(os.getenv("EXPIRE_MINUTES", 10080))
    env_config = Config(secret_key=env_secret_key, expire=expire)

    print("Mercury version: ", __version__)
    print("Using Mercury SQLite db: ", args.mercury_db)
    print("Using User SQLite db: ", args.user_db)

    database = Database(args.mercury_db, args.user_db)
    app.dependency_overrides[get_config] = lambda: env_config

    # TODO: the name 'tasks' can be misleading. It should be changed to something more descriptive.
    tasks = database.fetch_data_for_labeling()
    configs = database.fetch_configs()
    embedder = Embedder(configs["embedding_model_id"])

    uvicorn.run(app, port=args.port, host="0.0.0.0")
