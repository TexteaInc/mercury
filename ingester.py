__all__ = ["read_file_into_corpus"]

import json
import os
from typing import TypedDict

import jsonlines
import pandas
from dotenv import load_dotenv
from vectara import vectara


class Schema(TypedDict):
    _id: int
    source: str
    summary: str


# class SectionSlice(TypedDict):
#     _id: int
#     offset: int
#     text: str


class OwnChunk(TypedDict):
    _id: int
    true_offset: int
    true_len: int


class FullChunksWithMetadata(TypedDict):
    chunks_len: int
    full_doc_len: int
    chunks: list[str]
    chunk_metadata: list[OwnChunk]


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
            assert isinstance(source_id, int) and isinstance(summary_id, int)
            if source_id and summary_id:
                return source_id, summary_id
            else:
                raise Exception("Failed to create corpus")

    def reset_corpus(self, source_id: int, summary_id: int):
        self.client.reset_corpus(source_id)
        self.client.reset_corpus(summary_id)

    # def split_text_into_sections(self, text: str) -> list[SectionSlice]:
    #     section = []
    #     offset = 0
    #     for index, item in enumerate(text.split(".")):
    #         section.append({
    #             "_id": index + 1,
    #             "offset": offset,
    #             "text": item
    #         })
    #         offset += len(item) + 1
    #     return section

    # def split_text_into_sections(self, text: str) -> tuple[list[int], list[int], list[str]]:
    #     ids = []
    #     offsets = []
    #     strs = []
    #     offset = 0
    #     for index, item in enumerate(text.split(".")):
    #         ids.append(index + 1)
    #         offsets.append(offset)
    #         strs.append(item)
    #         offset += len(item) + 1
    #     return ids, offsets, strs

    def split_text_into_chunks(self, text: str) -> FullChunksWithMetadata:
        chunks: list[OwnChunk] = []
        full_doc_len = len(text)
        offset = 0
        strings = []
        for index, item in enumerate(text.split(".")):
            id_ = index + 1
            true_offset = offset
            chunks.append(
                {
                    "_id": id_,
                    "true_offset": true_offset,
                    "true_len": len(item),
                }
            )
            strings.append(item)
            offset += len(item) + 1
        return {
            "chunk_metadata": chunks,
            "chunks_len": len(chunks),
            "full_doc_len": full_doc_len,
            "chunks": strings,
        }

    def read_jsonl_into_corpus(self) -> tuple[int, int, list[Schema]]:
        source_id, summary_id = self.create_corpus()
        schemas = []
        with open(self.file_path, "r+", encoding="utf-8") as f:
            for index, item in enumerate(jsonlines.Reader(f)):
                source = item["source"]
                summary = item["summary"]
                id_ = f"mercury_{index}"
                source_info = self.split_text_into_chunks(source)
                self.client.create_document_from_chunks(
                    corpus_id=source_id,
                    chunks=source_info["chunks"],
                    chunk_metadata=source_info["chunk_metadata"],  # type: ignore
                    doc_id=id_,
                    doc_metadata={"type": "source", "full": source},
                )
                summary_info = self.split_text_into_chunks(summary)
                self.client.create_document_from_chunks(
                    corpus_id=summary_id,
                    chunks=summary_info["chunks"],
                    chunk_metadata=summary_info["chunk_metadata"],  # type: ignore
                    doc_id=id_,
                    doc_metadata={"type": "summary", "full": summary, "label": []},
                )
                schemas.append(
                    {
                        "_id": id_,
                        "source": source,
                        "summary": summary,
                    }
                )
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
                source_info = self.split_text_into_chunks(source)
                self.client.create_document_from_chunks(
                    corpus_id=source_id,
                    chunks=source_info["chunks"],
                    chunk_metadata=source_info["chunk_metadata"],  # type: ignore
                    doc_id=id_,
                    doc_metadata={"type": "source", "full": source},
                )
                summary_info = self.split_text_into_chunks(summary)
                self.client.create_document_from_chunks(
                    corpus_id=summary_id,
                    chunks=summary_info["chunks"],
                    chunk_metadata=summary_info["chunk_metadata"],  # type: ignore
                    doc_id=id_,
                    doc_metadata={"type": "summary", "full": summary, "label": []},
                )
                schemas.append(
                    {
                        "_id": id_,
                        "source": source,
                        "summary": summary,
                    }
                )
        return source_id, summary_id, schemas

    def read_csv_into_corpus(self) -> tuple[int, int, list[Schema]]:
        source_id, summary_id = self.create_corpus()
        schemas = []
        csv_data = pandas.read_csv(self.file_path)
        for index, item in csv_data.iterrows():
            source = item["source"]
            summary = item["summary"]
            id_ = f"mercury_{index}"
            source_info = self.split_text_into_chunks(source)
            self.client.create_document_from_chunks(
                corpus_id=source_id,
                chunks=source_info["chunks"],
                chunk_metadata=source_info["chunk_metadata"],  # type: ignore
                doc_id=id_,
                doc_metadata={"type": "source", "full": source},
                verbose=True,
            )
            summary_info = self.split_text_into_chunks(summary)
            self.client.create_document_from_chunks(
                corpus_id=summary_id,
                chunks=summary_info["chunks"],
                chunk_metadata=summary_info["chunk_metadata"],  # type: ignore
                doc_id=id_,
                doc_metadata={"type": "summary", "full": summary, "label": []},
                verbose=True,
            )
            schemas.append(
                {
                    "_id": id_,
                    "source": source,
                    "summary": summary,
                }
            )
        return source_id, summary_id, schemas

    def read_file_into_corpus(self) -> tuple[int, int, list[Schema]]:
        file_extension = self.file_path.split(".")[-1].lower()
        if file_extension.endswith("jsonl"):
            return self.read_jsonl_into_corpus()
        elif file_extension.endswith("json"):
            return self.read_json_into_corpus()
        elif file_extension.endswith("csv"):
            return self.read_csv_into_corpus()
        else:
            raise Exception("Unsupported file format")


def read_file_into_corpus() -> tuple[int, int, list[Schema]]:
    ingester = Ingester()
    return ingester.read_file_into_corpus()


if __name__ == "__main__":
    print("Uploading data to Vectara...")
    source_id, summary_id, schemas = read_file_into_corpus()
    print(f"Uploaded {len(schemas)} documents to Vectara")
    print(f"Source Corpus ID: {source_id}")
    print(f"Summary Corpus ID: {summary_id}")
