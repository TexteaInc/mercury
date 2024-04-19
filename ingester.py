__all__ = ["read_file_into_corpus"]

from dotenv import load_dotenv
from vectara import vectara
from typing import TypedDict
import jsonlines
import json
import os
import pandas


class Schema(TypedDict):
    _id: int
    source: str
    summary: str

load_dotenv()

def get_mercury_file_path() -> str:
    path = os.environ.get("MERCURY_FILE", None)
    if path is None:
        raise Exception("MERCURY_FILE not found in environment variables")
    return path

class Ingester:
    client = vectara()
    def __init__(self):
        self.file_path = get_mercury_file_path()
    
    def create_corpus(self) -> tuple[int, int]:
        source_id = int(os.environ.get("MERCURY_SOURCE_ID", -1))
        summary_id = int(os.environ.get("MERCURY_SUMMARY_ID", -1))
        if source_id != -1 and summary_id != -1:
            self.reset_corpus(source_id, summary_id)
            return source_id, summary_id
        else:
            source_id = self.client.create_corpus("mercury_source")
            summary_id = self.client.create_corpus("mercury_summary")
            if source_id and summary_id:
                return source_id, summary_id
            else:
                raise Exception("Failed to create corpus")
    
    def reset_corpus(self, source_id: int, summary_id: int):
        self.client.reset_corpus(source_id)
        self.client.reset_corpus(summary_id)
    
    def read_jsonl_into_corpus(self) -> tuple[int, int, list[Schema]]:
        source_id, summary_id = self.create_corpus()
        schemas = []
        with open(self.file_path, "r+", encoding="utf-8") as f:
            for index, item in enumerate(jsonlines.Reader(f)):
                source = item["source"]
                summary = item["summary"]
                id_ = f"mercury_{index}"
                self.client.upload_chunk(
                    corpus_id=source_id,
                    chunks=source.split("."),
                    doc_id=id_,
                    metadata={"type": "source"}
                )
                self.client.upload_chunk(
                    corpus_id=summary_id,
                    chunks=summary.split("."),
                    doc_id=id_,
                    metadata={"type": "summary"}
                )
                schemas.append({
                    "_id": id_,
                    "source": source,
                    "summary": summary
                })
        return source_id, summary_id, schemas
    
    def read_json_into_corpus(self) -> tuple[int, int, list[Schema]]:
        source_id, summary_id = self.create_corpus()
        schemas = []
        with open(self.file_path, "r+", encoding="utf-8") as f:
            data: list[dict] = json.load(f)
            for index, item in enumerate(data):
                source = item["source"]
                summary = item["summary"]
                id_ = f"mercury_{index}"
                self.client.upload_chunk(
                    corpus_id=source_id,
                    chunks=source.split("."),
                    doc_id=id_,
                    metadata={"type": "source"}
                )
                self.client.upload_chunk(
                    corpus_id=summary_id,
                    chunks=summary.split("."),
                    doc_id=id_,
                    metadata={"type": "summary"}
                )
                schemas.append({
                    "_id": id_,
                    "source": source,
                    "summary": summary
                })
        return source_id, summary_id, schemas
    
    def read_txt_into_corpus(self) -> tuple[int, int, list[Schema]]:
        source_id, summary_id = self.create_corpus()
        schemas = []
        csv_data = pandas.read_csv(self.file_path)
        for index, item in csv_data.iterrows():
            source = item["source"]
            summary = item["summary"]
            id_ = f"mercury_{index}"
            self.client.upload_chunk(
                corpus_id=source_id,
                chunks=source.split("."),
                doc_id=id_,
                metadata={"type": "source"}
            )
            self.client.upload_chunk(
                corpus_id=summary_id,
                chunks=summary.split("."),
                doc_id=id_,
                metadata={"type": "summary"}
            )
            schemas.append({
                "_id": id_,
                "source": source,
                "summary": summary
            })
        return source_id, summary_id, schemas
    
    def read_file_into_corpus(self) -> tuple[int, int, list[Schema]]:
        file_extension = self.file_path.split(".")[-1].lower()
        if file_extension.endswith("jsonl"):
            return self.read_jsonl_into_corpus()
        elif file_extension.endswith("json"):
            return self.read_json_into_corpus()
        elif file_extension.endswith("csv"):
            return self.read_txt_into_corpus()
        else:
            raise Exception("Unsupported file format")

def read_file_into_corpus() -> tuple[int, int, list[Schema]]:
    ingester = Ingester()
    return ingester.read_file_into_corpus()
