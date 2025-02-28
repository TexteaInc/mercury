import json
import uuid
from typing import List, Literal, TypedDict
import pandas as pd
import threading
import re
import argon2

import sqlite3
import sqlite_vec

from dotenv import load_dotenv
from version import __version__


class OldLabelData(TypedDict):  # readable by frontend
    record_id: str  # a unit name for the annotation
    sample_id: str  # traditionally, mercury_{\d+} where \d is the sample number, e.g., 15
    summary_start: int
    summary_end: int
    source_start: int
    source_end: int
    consistent: str  # used to be boolean
    task_index: int  # traditionally, \d+ where \d is the sample number, e.g., 15
    user_id: str
    note: str
    username: str


class AnnotSpan(TypedDict):  # In future expansion, the fields can be any user-defined fields
    source: tuple[int, int]  # optional
    summary: tuple[int, int]


class LabelData(TypedDict):  # human annotation on a sample
    annot_id: int
    sample_id: int
    annot_spans: AnnotSpan
    annotator: str
    label: str  # json string
    note: str


def convert_LabelData(lb: LabelData | OldLabelData,
                      direction: Literal["new2old", "old2new"], username: str) -> LabelData | OldLabelData:
    if direction == "old2new":
        return {
            "annot_id": lb["record_id"],
            # "sample_id": re.search(r"\d+", lb["sample_id"]).group(0),
            "sample_id": lb["task_index"],
            "annot_spans": {
                "source": (lb["source_start"], lb["source_end"]),
                "summary": (lb["summary_start"], lb["summary_end"])
            },
            "annotator": lb["user_id"],
            "label": lb["consistent"],
            "note": lb["note"]
        }
    elif direction == "new2old":
        return {
            "record_id": lb["annot_id"],
            # "sample_id": f"mercury_{lb['sample_id']}",
            "sample_id": f"mercury_{lb['sample_id']}",
            "summary_start": lb["annot_spans"].get("summary", (-1, -1))[0],
            "summary_end": lb["annot_spans"].get("summary", (-1, -1))[1],
            "source_start": lb["annot_spans"].get("source", (-1, -1))[0],
            "source_end": lb["annot_spans"].get("source", (-1, -1))[1],
            "consistent": lb["label"],
            "task_index": lb["sample_id"],
            "user_id": lb["annotator"],
            "note": lb["note"],
            "username": username
        }


class AnnotationLabelItem(TypedDict):
    text: str
    start: int
    end: int


class AnnotationItem(TypedDict):
    source: AnnotationLabelItem
    summary: AnnotationLabelItem
    # This is the same as the LabelData type
    consistent: str
    annotator: str


class AnnotationData(TypedDict):
    source: str
    summary: str
    annotations: List[AnnotationItem]


# def metadata_to_dict(metadata: list[dict]) -> dict:
#     metadata_dict = {}
#     for meta in metadata:
#         if meta["name"] in LabelData.__annotations__:
#             if LabelData.__annotations__[meta["name"]] is bool:
#                 metadata_dict[meta["name"]] = meta["value"] == "true"
#             else:
#                 metadata_dict[meta["name"]] = LabelData.__annotations__[meta["name"]](
#                     meta["value"]
#                 )
#         else:
#             metadata_dict[meta["name"]] = meta["value"]
#     return metadata_dict


# # def parse_documents_to_label_data_list(
# def fetch_annotations_from_corpus(client: Vectara, source_id: int) -> List[LabelData]:
#     print("Getting all documents from database for fast checking...")
#     data_list = []
#     for doc in client.list_all_documents(source_id):
#         # print(doc)
#         data_list.append(metadata_to_dict(doc["metadata"]))
#     return data_list

# def fetch_annotations(sqlite_db_path: str) -> List[LabelData]:
#     db = sqlite3.connect(sqlite_db_path)
# cmd = "SELECT annot_id, doc_id, annot_spans, annotator, label FROM annotations"
# annotations = db.execute(cmd).fetchall()
# db.close()

# label_data = []
# for annot_id, doc_id, annot_spans, annotator, label in annotations:
#     annot_spans = json.loads(text_spans)
#     label_data.append({
#         "record_id": annot_id,
#         "sample_id": doc_id, # traditionally, this is mercury_{\d+} where \d is the sample number, e.g., 15
#         "summary_start": text_spans["summary"][0],
#         "summary_end": text_spans["summary"][1],
#         "source_start": text_spans["source"][0],
#         "source_end": text_spans["source"][1],
#         "consistent": label,
#         "task_index": doc_id, # traditionally, this is \d+ where \d is the sample number, e.g., 15
#         "user_id": annotator
#     })

# annotations = pd.DataFrame.from_records(
#     label_data,
#     columns=["record_id", "sample_id", "summary_start", "summary_end", "source_start",
#              "source_end", "consistent", "task_index", "user_id"])
# return annotations

class Database:
    # class Annotate:
    # def __init__(self, annotation_corpus_id: int, vectara_client: Vectara = Vectara()):
    def __init__(self, mercury_db_path: str, user_db_path: str):
        self.lock = threading.Lock()
        # self.vectara_client = vectara_client
        # self.annotation_corpus_id = annotation_corpus_id
        # annotation_records: List[LabelData] = fetch_annotations_from_corpus(
        #     self.vectara_client, self.annotation_corpus_id
        # )
        # self.annotations = pd.DataFrame.from_records(
        #     annotation_records,
        #     columns=["record_id", "sample_id", "summary_start", "summary_end", "source_start",
        #              "source_end", "consistent", "task_index", "user_id"])
        # self.annotations = fetch_annotations(sqlite_db_path)

        # prepare the database
        mercury_db = sqlite3.connect(mercury_db_path)
        print("Open db at ", mercury_db_path)
        version = mercury_db.execute("SELECT value FROM config WHERE key = 'version'").fetchone()
        if version is None:
            print("Cannot find Mercury version in the database. Please migrate the database.")
            exit(1)
        elif version[0] != __version__:
                print (f"Mercury version mismatch between the code and the database file. The version in the database is {version[0]}, but the code version is {__version__}. Please migrate the database.")
                exit(1)
        mercury_db.execute("CREATE TABLE IF NOT EXISTS annotations (\
                   annot_id INTEGER PRIMARY KEY AUTOINCREMENT, \
                   sample_id INTEGER, \
                   annot_spans TEXT, \
                   annotator TEXT, \
                   label TEXT, \
                   note TEXT)")
        # mercury_db.execute(
        #     "CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, user_name TEXT)"
        # )
        # Comments
        mercury_db.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                annot_id INTEGER NOT NULL,
                parent_id INTEGER,
                text TEXT NOT NULL,
                comment_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (annot_id) REFERENCES annotations (annot_id)
            )
        """)
        mercury_db.enable_load_extension(True)
        sqlite_vec.load(mercury_db)
        mercury_db.enable_load_extension(False)
        mercury_db.commit()
        user_db = sqlite3.connect(user_db_path)
        user_db.execute("""CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            user_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL)""")
        user_db.commit()
        self.mercury_db = mercury_db  # Forrst is unsure whether it is a good idea to keep the db connection open
        self.user_db = user_db
        self.ph = argon2.PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)

    @staticmethod  # Forrest: Seems no need to update this function after Vectara-to-SQLite migration
    def database_lock():
        def decorator(func):
            def wrapper(self, *args, **kwargs):
                self.lock.acquire()
                result = func(self, *args, **kwargs)
                self.lock.release()
                return result

            return wrapper

        return decorator

    def fetch_data_for_labeling(self):
        """Fetch the source-summary pairs for labeling from the database."""

        data_for_labeling = {}
        sectioned_chunks = {}
        # db = sqlite3.connect(sqlite_db_path)
        db = self.mercury_db
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
    
    def get_annotation_comments(self, annot_id: int):
        sql_cmd = "SELECT * FROM comments WHERE annot_id = ?"
        res = self.mercury_db.execute(sql_cmd, (annot_id,))
        comments = res.fetchall()
        return comments


    def get_comment_by_id(self, comment_id: int):
        sql_cmd = "SELECT * FROM comments WHERE comment_id = ?"
        res = self.mercury_db.execute(sql_cmd, (comment_id,))
        comment = res.fetchone()
        return comment


    @database_lock()
    def commit_comment(self, user_id: str, annot_id: int, parent_id: int | None, text: str):
        sql_cmd = "SELECT annot_id FROM annotations WHERE annot_id = ?"
        res = self.mercury_db.execute(sql_cmd, (annot_id,))
        if res.fetchone() is None:
            return
        if parent_id is not None:
            sql_cmd = "SELECT comment_id FROM comments WHERE comment_id = ?"
            res = self.mercury_db.execute(sql_cmd, (parent_id,))
            if res.fetchone() is None:
                return
        sql_cmd = "INSERT INTO comments (user_id, annot_id, parent_id, text) VALUES (?, ?, ?, ?)"
        self.mercury_db.execute(sql_cmd, (user_id, annot_id, parent_id, text))
        self.mercury_db.commit()

    @database_lock()
    def edit_comment(self, user_id: str, comment_id: int, text: str):
        sql_cmd = "SELECT user_id FROM comments WHERE comment_id = ?"
        res = self.mercury_db.execute(sql_cmd, (comment_id,))
        comment = res.fetchone()
        if comment is None:
            return
        if comment[0] != user_id:
            return
        sql_cmd = "UPDATE comments SET text = ? WHERE comment_id = ?"
        self.mercury_db.execute(sql_cmd, (text, comment_id))
        self.mercury_db.commit()


    @database_lock()
    def delete_comment(self, user_id: str, comment_id: int):
        sql_cmd = "SELECT user_id FROM comments WHERE comment_id = ?"
        res = self.mercury_db.execute(sql_cmd, (comment_id,))
        comment = res.fetchone()
        if comment is None:
            return
        if comment[0] != user_id:
            return
        sql_cmd = "DELETE FROM comments WHERE comment_id = ?"
        self.mercury_db.execute(sql_cmd, (comment_id,))
        self.mercury_db.commit()

    def fetch_configs(self):
        # db = sqlite3.connect(sqlite_db_path)
        configs = self.mercury_db.execute("SELECT key, value FROM config").fetchall()
        return {key: value for key, value in configs}

    @database_lock()
    def update_annotation(self, label_data: OldLabelData):
        # find the record_id in the database
        sql_cmd = "SELECT annotator FROM annotations WHERE annot_id = ?"
        res = self.mercury_db.execute(sql_cmd, (label_data["record_id"],))
        annotation = res.fetchone()
        if annotation is None:
            return None
        # check annotator
        if annotation[0] != label_data["annotator"]:
            return False
        # update the record
        sql_cmd = "UPDATE annotations SET annot_spans = ?, label = ?, note = ? WHERE annot_id = ?"
        self.mercury_db.execute(sql_cmd, (
            json.dumps(label_data["annot_spans"]),
            label_data["label"],
            label_data["note"],
            label_data["record_id"],
        ))
        self.mercury_db.commit()
        return True

    @database_lock()
    def push_annotation(self, label_data: OldLabelData):
        # First make sure there is no duplicate in the DB
        # if (
        #         (self.annotations["sample_id"] == label_data["sample_id"]) &
        #         (self.annotations["summary_start"] == label_data["summary_start"]) &
        #         (self.annotations["summary_end"] == label_data["summary_end"]) &
        #         (self.annotations["source_start"] == label_data["source_start"]) &
        #         (self.annotations["source_end"] == label_data["source_end"]) &
        #         (self.annotations["task_index"] == label_data["task_index"]) &
        #         (self.annotations["user_id"] == label_data["user_id"])
        # ).any():
        #     return

        sql_cmd = "SELECT * FROM annotations WHERE sample_id = ? AND annot_spans = ? AND annotator = ? AND label = ? AND note = ?"
        res = self.mercury_db.execute(sql_cmd, (
            label_data["sample_id"],
            json.dumps(label_data["annot_spans"]),
            label_data["annotator"],
            label_data["label"],
            label_data["note"]
        ))
        if res.fetchone() is not None:
            return

        # record_id = uuid.uuid4().hex # No need for this line in SQLite because it auto-increments
        # label_data["record_id"] = record_id
        # self.annotations.loc[len(self.annotations.index)] = (
        # label_data["record_id"],
        #     label_data["sample_id"],
        #     label_data["summary_start"],
        #     label_data["summary_end"],
        #     label_data["source_start"],
        #     label_data["source_end"],
        #     label_data["consistent"],
        #     label_data["task_index"],
        #     label_data["user_id"],
        # )
        # self.vectara_client.create_document_from_chunks(
        #     corpus_id=self.annotation_corpus_id,
        #     chunks=["NO CHUNKS"],
        #     doc_id=record_id,
        #     doc_metadata=label_data,  # type: ignore
        # )

        # label_data = convert_LabelData(label_data, "old2new")

        sql_cmd = "INSERT INTO annotations (sample_id, annot_spans, annotator, label, note) VALUES (?, ?, ?, ?, ?)"
        self.mercury_db.execute(sql_cmd, (
            label_data["sample_id"],
            json.dumps(label_data["annot_spans"]),
            label_data["annotator"],
            label_data["label"],
            label_data["note"]
        ))
        self.mercury_db.commit()

    @database_lock()
    # def delete_annotation(self, record_id: str, user_id: str):
    def delete_annotation(self, record_id: str, annotator: str):
        # if not (
        #         (self.annotations["record_id"] == record_id)
        #         & (self.annotations["user_id"] == user_id)
        # ).any():
        #     return
        # record_index = self.annotations[self.annotations["record_id"] == record_id].index
        # self.annotations.drop(record_index, inplace=True)
        # self.vectara_client.delete_document(self.annotation_corpus_id, record_id)
        sql_cmd = "DELETE FROM annotations WHERE annot_id = ? AND annotator = ?"
        result = self.mercury_db.execute(sql_cmd, (int(record_id), annotator))
        if result.rowcount == 0:
            return False
        self.mercury_db.commit()
        return True

    @database_lock()
    def change_user_name(self, user_id: str, user_name: str):
        self.user_db.execute("UPDATE users SET user_name = ? WHERE user_id = ?", (user_name, user_id))
        self.user_db.commit()

    def get_user_by_id(self, user_id: str):
        res = self.user_db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
        user = res.fetchone()
        return user

    def get_user_name_without_lock(self, user_id: str) -> str:
        res = self.user_db.execute("SELECT user_name FROM users WHERE user_id = ?", (user_id,))
        user_name = res.fetchone()
        if user_name is None:
            return None
        return user_name[0]

    # def export_user_data(self, user_id: str) -> list[LabelData]:
    def export_user_data(self, annotator_uuid: str) -> list[LabelData]:
        # return self.annotations[self.annotations["user_id"] == user_id].to_dict(orient="records")
        sql_cmd = "SELECT * FROM annotations WHERE annotator = ?"
        res = self.mercury_db.execute(sql_cmd, (annotator_uuid,))
        annotations = res.fetchall()
        label_data = []  # in OldLabelData format
        for annot_id, sample_id, annot_spans, annotator_uuid, label, note in annotations:
            annot_spans = json.loads(annot_spans)
            label_data.append(convert_LabelData({
                "annot_id": annot_id,
                "sample_id": sample_id,
                "annot_spans": annot_spans,
                "annotator": annotator_uuid,
                "label": json.loads(label),
                "note": note
            }, "new2old"))
        return label_data

    # def export_task_history(self, task_index: int, user_id: str) -> list[LabelData]:
    def export_task_history(self, sample_id: int) -> list[LabelData]:
        # return self.annotations[
        #         (self.annotations["user_id"] == user_id) &
        #         (self.annotations["task_index"] == task_index)
        #     ].to_dict(orient="records")
        sql_cmd = "SELECT * FROM annotations WHERE sample_id = ?"
        res = self.mercury_db.execute(sql_cmd, (sample_id,))
        annotations = res.fetchall()
        label_data = []
        usernames = {}
        for annot_id, sample_id, annot_spans, annotator, label, note in annotations:
            annot_spans = json.loads(annot_spans)
            if annotator not in usernames:
                username = self.get_user_name_without_lock(annotator)
                if username is not None:
                    usernames[annotator] = username
                else:
                    usernames[annotator] = "Unknown"

            label_data.append(convert_LabelData({
                "annot_id": annot_id,
                "sample_id": sample_id,
                "annot_spans": annot_spans,
                "annotator": annotator,
                "label": json.loads(label),
                "note": note
            }, "new2old", usernames[annotator]))
        return label_data

    def dump_annotator_labels(self, annotator: str):
        sql_cmd = "SELECT * FROM annotations WHERE annotator = ?"
        res = self.mercury_db.execute(sql_cmd, (annotator,))
        annotations = res.fetchall()
        results = []
        results_dict = {}
        for annot_id, sample_id, annot_spans, annotator, label, note in annotations:
            # find the source and summary text by doc_id
            full_texts = {}
            for text_type in ["source", "summary"]:
                sql_cmd = "SELECT text FROM chunks WHERE sample_id = ? AND text_type = ? ORDER BY chunk_offset"
                res = self.mercury_db.execute(sql_cmd, (sample_id, text_type))
                text = res.fetchall()  # text =  [('The quick brown fox.',), ('Jumps over a lazy dog.',)]
                text = [t[0] for t in text]
                full_texts[text_type] = " ".join(text)

            result_local = {"annot_id": annot_id, "sample_id": sample_id, "annotator": annotator,
                            "label": json.loads(label), "note": note,
                            "annotator_name": self.get_user_name_without_lock(annotator)}
            # annot_spans example: {'source': (1, 10), 'summary': (7, 10)}
            annot_spans = json.loads(annot_spans)
            for text_type, (start, end) in annot_spans.items():
                # print(full_texts)
                result_local[f"{text_type}_span"] = full_texts[text_type][start:end]
                result_local[f"{text_type}_start"] = start
                result_local[f"{text_type}_end"] = end

            results.append(result_local)

            results_dict.setdefault(sample_id, {"source": full_texts["source"], "summary": full_texts["summary"],
                                                "annotations": []})
            results_dict[sample_id]["annotations"].append(result_local)

        results_nested = [{"sample_id": key, **value} for key, value in results_dict.items()]

        # TODO: copy and paste from dump_annotation is too ugly. Please turn common code to a function

        sql_cmd = "SELECT * from sample_meta"  # get the metadata
        res = self.mercury_db.execute(sql_cmd)
        sample_meta = res.fetchall()
        sample_meta_dict = {sample_id: json.loads(json_meta) for sample_id, json_meta in sample_meta}
        sample_meta_dict = {sample_id: {f"meta_{k}": v for k, v in meta.items()} for sample_id, meta in
                            sample_meta_dict.items()}

        # add metadata to each dict in results_nested
        new_results_nested = []
        for result in results_nested:
            sample_id = result["sample_id"]
            new_results_nested.append(result | sample_meta_dict[sample_id])
        results_nested = new_results_nested

        return results_nested

    # def dump_all_data(
    def dump_annotation(
            self,
            dump_file: str | None = "mercury_annotations.json",
            # source_corpus_id: int | None = None,
            # summary_corpus_id: int | None = None,
    ):

        sql_cmd = "SELECT * FROM annotations"
        res = self.mercury_db.execute(sql_cmd)
        annotations = res.fetchall()

        # match annotations with chunks by doc_id
        results = []
        results_dict = {}  # keys are sample_id, values are source text, summary text, and each pair of spans and labels and annotators
        for annot_id, sample_id, annot_spans, annotator, label, note in annotations:
            # find the source and summary text by doc_id
            full_texts = {}
            for text_type in ["source", "summary"]:
                sql_cmd = "SELECT text FROM chunks WHERE sample_id = ? AND text_type = ? ORDER BY chunk_offset"
                res = self.mercury_db.execute(sql_cmd, (sample_id, text_type))
                text = res.fetchall()  # text =  [('The quick brown fox.',), ('Jumps over a lazy dog.',)]
                text = [t[0] for t in text]
                full_texts[text_type] = " ".join(text)

            result_local = {"annot_id": annot_id, "sample_id": sample_id, "annotator": annotator,
                            "label": json.loads(label), "note": note,
                            "annotator_name": self.get_user_name_without_lock(annotator)}
            # annot_spans example: {'source': (1, 10), 'summary': (7, 10)}
            annot_spans = json.loads(annot_spans)
            for text_type, (start, end) in annot_spans.items():
                result_local[f"{text_type}_span"] = full_texts[text_type][start:end]
                result_local[f"{text_type}_start"] = start
                result_local[f"{text_type}_end"] = end

            results.append(result_local)

            results_dict.setdefault(sample_id, {"source": full_texts["source"], "summary": full_texts["summary"],
                                                "annotations": []})
            results_dict[sample_id]["annotations"].append(result_local)

        results_nested = [{"sample_id": key, **value} for key, value in results_dict.items()]

        sql_cmd = "SELECT * from sample_meta"  # get the metadata
        res = self.mercury_db.execute(sql_cmd)
        sample_meta = res.fetchall()
        sample_meta_dict = {sample_id: json.loads(json_meta) for sample_id, json_meta in sample_meta}
        sample_meta_dict = {sample_id: {f"meta_{k}": v for k, v in meta.items()} for sample_id, meta in
                            sample_meta_dict.items()}

        # add metadata to each dict in results_nested
        new_results_nested = []
        annotated_sample_ids = set()
        for result in results_nested:
            sample_id = result["sample_id"]
            new_results_nested.append(result | sample_meta_dict[sample_id])
            annotated_sample_ids.add(sample_id)
        for sample_id in sample_meta_dict:
            if sample_id not in annotated_sample_ids:
                full_texts = {}
                for text_type in ["source", "summary"]:
                    sql_cmd = "SELECT text FROM chunks WHERE sample_id = ? AND text_type = ? ORDER BY chunk_offset"
                    res = self.mercury_db.execute(sql_cmd, (sample_id, text_type))
                    text = res.fetchall()  # text =  [('The quick brown fox.',), ('Jumps over a lazy dog.',)]
                    text = [t[0] for t in text]
                    full_texts[text_type] = " ".join(text)
                sample_dict = {"sample_id": sample_id, "source": full_texts["source"], "summary": full_texts["summary"],
                               "annotations": []}
                sample_dict.update(sample_meta_dict[sample_id])
                new_results_nested.append(sample_dict)

        results_nested = new_results_nested
        results_nested = sorted(results_nested, key=lambda d: d['sample_id'])

        if dump_file is None:
            return results_nested
        with open(dump_file, "w") as f:
            json.dump(results_nested, f, indent=2, ensure_ascii=False)
            # TODO add JSONL support. Automatically detect file format based on filename extension

    def auth_user(self, email: str, password: str):
        res = self.user_db.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = res.fetchone()
        if user is None:
            return False, None
        try:
            success = self.ph.verify(user[3], password)
        except argon2.exceptions.VerifyMismatchError:
            success = False
        return success, user[0]


if __name__ == "__main__":
    import argparse
    import os

    load_dotenv()


    def get_env_id_value(env_name: str) -> int | None:
        env = os.environ.get(env_name, None)
        if env is not None:
            return int(env)
        return None


    parser = argparse.ArgumentParser(
        description="Dump all annotations from a Vectara corpus to a JSON file.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument("--mercury_db_path", type=str, required=True, help="Path to the Mercury SQLite database")
    parser.add_argument("--user_db_path", type=str, required=True, help="Path to the user SQLite database")
    parser.add_argument("--dump_file", type=str, required=True, default="mercury_annotations.json")
    parser.add_argument("--version", action="version", version="__version__")
    args = parser.parse_args()

    # db = Database(args.annotation_corpus_id)
    db_obj = Database(args.mercury_db_path, args.user_db_path)
    print(f"Dumping all data to {args.dump_file}")
    # db.dump_all_data(args.dump_file, args.source_corpus_id, args.summary_corpus_id)
    db_obj.dump_annotation(args.dump_file)
