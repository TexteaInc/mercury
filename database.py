import json
import uuid
from typing import List, Literal, TypedDict
import pandas as pd
import threading
import re

import sqlite3
import sqlite_vec

from dotenv import load_dotenv

class OldLabelData(TypedDict):  # readable by frontend
    record_id: str # a unit name for the annotation
    sample_id: str # traditionally, mercury_{\d+} where \d is the sample number, e.g., 15
    summary_start: int
    summary_end: int
    source_start: int
    source_end: int
    consistent: str # used to be boolean 
    task_index: int # traditionally, \d+ where \d is the sample number, e.g., 15
    user_id: str

class AnnotSpan(TypedDict): # In future expansion, the fields can be any user-defined fields
    source: tuple[int, int] # optional
    summary: tuple[int, int]

class LabelData(TypedDict):  # human annotation on a sample
    annot_id: int 
    sample_id: int 
    annot_spans: AnnotSpan
    annotator: str
    label: str

def convert_LabelData(lb: LabelData | OldLabelData, direction: Literal["new2old", "old2new"] ) -> LabelData | OldLabelData: 
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
            "label": lb["consistent"]
        }
    elif direction == "new2old":
        return {
            "record_id": lb["annot_id"],
            # "sample_id": f"mercury_{lb['sample_id']}",
            "sample_id": f"mercury_{lb["sample_id"]}",
            "summary_start": lb["annot_spans"]["summary"][0],
            "summary_end": lb["annot_spans"]["summary"][1],
            "source_start": lb["annot_spans"].get("source", (-1, -1))[0],
            "source_end": lb["annot_spans"].get("source", (-1, -1))[1],
            "consistent": lb["label"],
            "task_index": lb["sample_id"],
            "user_id": lb["annotator"]
        }

class AnnotationLabelItem(TypedDict):
    text: str
    start: int
    end: int

class AnnotationItem(TypedDict):
    source: AnnotationLabelItem
    summary: AnnotationLabelItem
    consistent: bool
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
    # def __init__(self, annotation_corpus_id: int, vectara_client: Vectara = Vectara()):
    def __init__(self, sqlite_db_path: str):
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
        db = sqlite3.connect(sqlite_db_path)
        db.execute("CREATE TABLE IF NOT EXISTS annotations (\
                   annot_id INTEGER PRIMARY KEY AUTO_INCREMENT, \
                   sample_id INTEGER, \
                   annot_spans TEXT, \
                   annotator TEXT, \
                   label TEXT)")
        db.commit()
        self.db = db # Forrst is unsure whether it is a good idea to keep the db connection open

    @staticmethod # Forrest: Seems no need to update this function after Vectara-to-SQLite migration
    def database_lock():
        def decorator(func):
            def wrapper(self, *args, **kwargs):
                self.lock.acquire()
                result = func(self, *args, **kwargs)
                self.lock.release()
                return result
            return wrapper
        return decorator

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

        sql_cmd = "SELECT * FROM annotations WHERE sample_id = ? AND annot_spans = ? AND annotator = ? AND label = ?"
        self.db.execute(sql_cmd, (
            label_data["sample_id"],
            json.dumps(label_data["annot_spans"]),
            label_data["annotator"],
            label_data["label"]
        ))
        if self.db.fetchone() is not None:
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

        label_data = convert_LabelData(label_data, "old2new")

        sql_cmd = "INSERT INTO annotations (sample_id, annot_spans, annotator, label) VALUES (?, ?, ?, ?)"
        self.db.execute(sql_cmd, (
            label_data["sample_id"],
            json.dumps(label_data["annot_spans"]),
            label_data["annnotator"],
            label_data["label"]))
        self.db.commit()

    @database_lock()
    # def delete_annotation(self, record_id: str, user_id: str):
    def delete_annotation(self, sample_id: str, annotator: str):
        # if not (
        #         (self.annotations["record_id"] == record_id)
        #         & (self.annotations["user_id"] == user_id)
        # ).any():
        #     return
        # record_index = self.annotations[self.annotations["record_id"] == record_id].index
        # self.annotations.drop(record_index, inplace=True)
        # self.vectara_client.delete_document(self.annotation_corpus_id, record_id)
        sql_cmd = "DELETE FROM annotations WHERE sample_id = ? AND annotator = ?"
        self.db.execute(sql_cmd, (sample_id, annotator))
        self.db.commit()

    @database_lock()
    # def export_user_data(self, user_id: str) -> list[LabelData]:
    def export_user_data(self, annotator: str) -> list[LabelData]:
        # return self.annotations[self.annotations["user_id"] == user_id].to_dict(orient="records")
        sql_cmd = "SELECT * FROM annotations WHERE annotator = ?"
        self.db.execute(sql_cmd, (annotator,))
        annotations = self.db.fetchall()
        label_data = [] # in OldLabelData format
        for annot_id, sample_id, annot_spans, annotator, label in annotations:
            annot_spans = json.loads(annot_spans)
            label_data.append(convert_LabelData({
                "annot_id": annot_id,
                "sample_id": sample_id, 
                "annot_spans": annot_spans,
                "annotator": annotator,
                "label": label
            }, "new2old"))

    @database_lock()
    # def export_task_history(self, task_index: int, user_id: str) -> list[LabelData]:
    def export_task_history(self, sample_id: int, annotator: str) -> list[LabelData]:
        # return self.annotations[
        #         (self.annotations["user_id"] == user_id) &
        #         (self.annotations["task_index"] == task_index)
        #     ].to_dict(orient="records")
        sql_cmd = "SELECT * FROM annotations WHERE annotator = ? AND sample_id = ?"
        self.db.execute(sql_cmd, (annotator, sample_id))
        annotations = self.db.fetchall()
        label_data = []
        for annot_id, sample_id, annot_spans, annotator, label in annotations:
            annot_spans = json.loads(annot_spans)
            label_data.append(convert_LabelData({
                "annot_id": annot_id,
                "sample_id": sample_id, 
                "annot_spans": annot_spans,
                "annotator": annotator,
                "label": label
            }, "new2old"))

    @database_lock()
    def dump_all_data(
            self,
            dump_file: str = "mercury_annotations.json",
            # source_corpus_id: int | None = None,
            # summary_corpus_id: int | None = None,
    ) -> list[AnnotationData]:
        # if source_corpus_id is None or summary_corpus_id is None:
        #     raise ValueError("Source and Summary corpus IDs are required.")

        # def get_source_and_summary_from_sample_id(sample_id: str) -> tuple[str, str]:
        #     source_response = self.vectara_client.list_documents_with_filter(
        #         corpus_id=source_corpus_id,
        #         numResults=1,
        #         pageKey=None,
        #         metadataFilter=f"doc.id = '{sample_id}'",
        #     )
        #     summary_response = self.vectara_client.list_documents_with_filter(
        #         corpus_id=summary_corpus_id,
        #         numResults=1,
        #         pageKey=None,
        #         metadataFilter=f"doc.id = '{sample_id}'",
        #     )
        #     if (
        #             len(source_response["document"]) < 0
        #             or len(summary_response["document"]) < 0
        #     ):
        #         raise ValueError(
        #             f"Sample ID {sample_id} not found in source or summary corpus."
        #         )

        #     source_metadata = metadata_to_dict(
        #         source_response["document"][0]["metadata"]
        #     )
        #     summary_metadata = metadata_to_dict(
        #         summary_response["document"][0]["metadata"]
        #     )

        #     source = source_metadata["text"]
        #     summary = summary_metadata["text"]

        #     return source, summary

        # result: list[AnnotationData] = []

        # with_id: dict[str, AnnotationData] = {}

        # id_source_summary: dict[str, dict[Literal["source", "summary"], str]] = {}

        # for doc in self.vectara_client.list_all_documents(self.annotation_corpus_id):
        #     metadata = metadata_to_dict(doc["metadata"])
        #     sample_id = metadata["sample_id"]
        #     if sample_id not in id_source_summary:
        #         source, summary = get_source_and_summary_from_sample_id(sample_id)
        #         id_source_summary[sample_id] = {"source": source, "summary": summary}
        #     if sample_id not in with_id:
        #         with_id[sample_id] = {
        #             "source": id_source_summary[sample_id]["source"],
        #             "summary": id_source_summary[sample_id]["summary"],
        #             "annotations": [],
        #         }
        #     with_id[sample_id]["annotations"].append(
        #         {
        #             "source": {
        #                 "start": metadata["source_start"],
        #                 "end": metadata["source_end"],
        #                 "text": with_id[sample_id]["source"][
        #                         metadata["source_start"]: metadata["source_end"]
        #                         ],
        #             },
        #             "summary": {
        #                 "start": metadata["summary_start"],
        #                 "end": metadata["summary_end"],
        #                 "text": with_id[sample_id]["summary"][
        #                         metadata["summary_start"]: metadata["summary_end"]
        #                         ],
        #             },
        #             "consistent": metadata["consistent"],
        #             "annotator": metadata["user_id"],
        #         }
        #     )

        # for sample_id, data in with_id.items():
        #     result.append(
        #         {
        #             "source": data["source"],
        #             "summary": data["summary"],
        #             "annotations": data["annotations"],
        #         }
        #     )

        # with open(dump_file, "w") as f:
        #     json.dump(result, f, indent=4, ensure_ascii=False)

        # return result

        sql_cmd = "SELECT * FROM annotations"
        self.db.execute(sql_cmd)
        annotations = self.db.fetchall()

        # match annotations with chunks by doc_id
        results = []
        for annot_id, sample_id, annot_spans, annotator, label in annotations:
            # find the source and summary text by doc_id
            full_texts = {}
            for text_type in ["source", "summary"]:
                sql_cmd = "SELECT text FROM chunks WHERE sample_id = ? AND text_type = ? ORDER BY chunk_offset"
                self.db.execute(sql_cmd, (sample_id, text_type))
                text = self.db.fetchall()
                full_texts[text_type] = " ".join(text)
            
            result_local = {"annot_id": annot_id, "sample_id": sample_id, "annotator": annotator, "label": label}
            annot_spans = json.loads(annot_spans)
            for text_type, (start, end) in annot_spans.items():
                result_local[f"{text_type}_span"] = full_texts[text_type][start:end]

            results.append(result_local)

        with open(dump_file, "w") as f:
            json.dump(results, f, indent=s, ensure_ascii=False)
            #TODO add JSONL support. Automatically detect file format based on filename extension


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
        description="Dump all annotations from a Vectara corpus to a JSON file."
    )
    parser.add_argument("sqlite_db_path", type=str, help="Path to the SQLite database")
    parser.add_argument("--dump_file", type=str, default="mercury_annotations.json")
    args = parser.parse_args()

    # db = Database(args.annotation_corpus_id)
    db_obj = Database(args.sqlite_db_path)
    print(f"Dumping all data to {args.dump_file}")
    # db.dump_all_data(args.dump_file, args.source_corpus_id, args.summary_corpus_id)
    db_obj.dump_all_data(args.dump_file)
