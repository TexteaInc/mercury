import json
import os
import sys
import uuid
from functools import lru_cache
from typing import Annotated, Literal, List, Dict
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
    text1_start: int
    text1_end: int
    text2_start: int
    text2_end: int
    consistent: list[str]
    note: str

class Annotation(BaseModel): # introduced by Forrest, July 1, 2025
    text1_start: int
    text1_end: int
    text2_start: int
    text2_end: int
    labels: list[str]
    note: str


class Selection(BaseModel):
    start: int
    end: int
    text_type: Literal["text1", "text2"]


# Disabled by Forrest, July 1, 2025
# class Name(BaseModel):
#     name: str


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


class Name(BaseModel):
    name: str


def get_config():
    raise NotImplementedError("This should be overridden.")

# FIXME: Why is the line below in the middle of function definitions?
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def create_access_token(data: dict, secret_key: str, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=11520)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm="HS256")
    return encoded_jwt

@app.get("/login")
async def login():
    return FileResponse("dist/login.html")

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


@app.get("/labels")
async def get_labels() -> list:  # get all candidate labels for human annotators to choose from
    with open("labels.yaml") as f:
        labels = yaml.safe_load(f)
    return labels

@app.get("/titles")
async def get_titles() -> list:
    return database.fetch_titles()

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


@app.get(
    "/user/export"
)  # please update the route name to be more meaningful, e.g., /user/export_user_data
async def export_user_data(user: Annotated[User, Depends(get_user)]):
    return database.dump_annotator_labels(user.id)


@app.get("/samples")
async def get_num_samples():
    return {"num_samples": len(samples)}


@app.get("/sample/{sample_id}")
async def get_sample(sample_id: int):
    if sample_id >= len(samples):
        return {"error": "Invalid sample index"}
    sample = samples[sample_id]
    return {"text1": sample["text1"], "text2": sample["text2"]}


@app.get("/sample/{sample_id}/history")
async def get_sample_history(sample_id: int, _: Annotated[User, Depends(get_user)]):
    return database.export_example_history(sample_id)

@app.get("/sample/{sample_id}/complimentary_annotations/{user_id}")
async def get_other_annotations(sample_id: int, user_id: str):
    """Get the annotations of other annotators for the sample."""
    return database.get_others_annotations(user_id, sample_id)


@app.post("/sample/{sample_id}/annot")
async def push_annotation(sample_id: int, annot: Annotation, user: Annotated[User, Depends(get_user)]):
    """
    Add a new annotation to the sample.
    """
    sample_id = sample_id
    annot_spans = {}
    if annot.text1_start != -1:
        annot_spans["text1"] = (annot.text1_start, annot.text1_end)
    if annot.text2_start != -1:
        annot_spans["text2"] = (annot.text2_start, annot.text2_end)

    annotator = user.id

    label_string = json.dumps(annot.labels)

    database.push_annotation({
        "sample_id": sample_id,
        "annotator": annotator,
        "label": label_string,
        "annot_spans": annot_spans,
        "note": annot.note
    })
    return {"message": "success"}


@app.patch("/sample/{sample_id}/annot/{annot_id}")
async def update_annotation(sample_id: int, annot_id: int, annot: Annotation, user: Annotated[User, Depends(get_user)]):
    """
    Update an existing annotation.
    """
    sample_id = sample_id
    annot_spans = {}
    if annot.text1_start != -1:
        annot_spans["text1"] = (annot.text1_start, annot.text1_end)
    if annot.text2_start != -1:
        annot_spans["text2"] = (annot.text2_start, annot.text2_end)

    annotator = user.id

    label_string = json.dumps(annot.labels)

    database.update_annotation({
        "annot_id": annot_id,
        "sample_id": sample_id,
        "annotator": annotator,
        "label": label_string,
        "annot_spans": annot_spans,
        "note": annot.note
    })
    return {"message": "success"}

@app.delete("/annot/{annot_id}")
async def delete_annotation( annot_id: int, user: Annotated[User, Depends(get_user)]):
    database.delete_annotation(annot_id, user.id)
    return {"message": f"annotation {annot_id} deleted"}

def break_into_n_grams(text: str, n: int = 5):
    return [text[i:i + n] for i in range(0, len(text), n)]

@app.post("/sample/{sample_id}/query")
async def search(sample_id: int, selection: Selection):
    """
    Search for the most similar chunks in the database.
    """
    if sample_id >= len(samples) or sample_id < 0:
        return {"error": "Invalid sample index"}
    query = (
        samples[sample_id][selection.text_type][selection.start: selection.end]
    )
    # id_ = samples[sample_id]["_id"]

    # first embedd query
    embedding = embedder.embed([query], embedding_dimension=configs["embedding_dimension"])[0]

    # Then get the chunk_id's from the opposite document
    # sql_cmd = "SELECT chunk_id, text FROM chunks WHERE text_type = ? AND sample_id = ?"
    opposite_text_type = {"text1": "text_2", "text2": "text_1"}[selection.text_type]

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
    sql_cmd = f"SELECT chunk_id, distance FROM chunks WHERE k = 5 AND sample_id = {sample_id} AND text_type = '{opposite_text_type}' AND embedding MATCH '{embedding}' ORDER BY distance"
    # TODO: Please allow users to select k value via a sliding bar
    print ("SQL_CMD", sql_cmd)

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
    # [(1, 'This is a test.', 0, 14), (2, 'This is a test.', 15, 14)]

    # organize into a dict of keys "score", "offset", "len", "to_doc"
    # and append to a list of selections
    selections = []
    for i in response:
        print(selection)
        score = chunk_id_to_score[i[0]]
        offset = i[2]
        text = i[1]
        selections.append(
            {
                "score": 1 - score,  # semantic similarity is 1 - distance
                "offset": offset,
                "len": len(text),
                "text_type": {"text1": "text2", "text2": "text1"}[selection.text_type],
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

# FIXME: Should the URL be /sample/{sample_id}/annot/{annot_id}/comments?
@app.post("/annot/{annot_index}/comments")
async def post_comments(annot_index: int, comment: CommentData, user: Annotated[User, Depends(get_user)]):
    database.commit_comment(user.id, annot_index, comment.parent_id, comment.text)
    return {"message": "success"}


@app.delete("/annot/{annot_index}/comment/{comment_id}")
async def delete_comments(annot_index: int, comment_id: int, user: Annotated[User, Depends(get_user)]):
    comment = database.get_comment_by_id(comment_id)
    if comment[1] != user.id or comment[2] != annot_index:
        raise HTTPException(status_code=403)
    database.delete_comment(user.id, comment_id)
    return {"message": "success"}


@app.patch("/annot/{annot_index}/comment/{comment_id}")
async def patch_comments(annot_index: int, comment_id: int, comment: CommentData,
                         user: Annotated[User, Depends(get_user)]):
    target = database.get_comment_by_id(comment_id)
    if target[1] != user.id or target[2] != annot_index:
        raise HTTPException(status_code=403)
    database.edit_comment(user.id, comment_id, comment.text)
    return {"message": "success"}


@app.get("/annots")
async def get_annotations():
    return database.dump_annotation(dump_file=None)


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

    samples = database.fetch_data_for_labeling()
    configs = database.fetch_configs()
    embedder = Embedder(configs["embedding_model_id"])

    uvicorn.run(app, port=args.port, host="0.0.0.0")
