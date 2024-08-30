import json
from enum import Enum
from typing import Dict, List, Literal, Tuple, TypedDict

import sqlite3, sqlite_vec
import spacy 
import pandas
import requests
from dotenv import load_dotenv
from tqdm.auto import tqdm

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


class Embedder: 
    def __init__(self, name: Literal['bge-m3']):
        if name == 'bge-m3':+
        
            from FlagEmbedding import BGEM3FlagModel

        

def embed_text(
        ts: List[str], 
        model_id: str, 
        embed_dim: int = 512 
        ):
    """Embed a list of strings using a model on HF"""
    pass 

def chunk_text(
        ts: List[str], 
): 


class Ingester:
    def __init__(
        self,
        file_to_ingest: str,

        append_to_corpora: bool = False,
        embedding_dimension: int = 512,
        embedding_model_id: str = "BAAI/bge-m3",
        sqlite_db_path: str = "./mercury.sqlite",
    ):
        self.sources = None
        self.summaries = None
        self.sqlite_db_path = sqlite_db_path
        self.embedding_dimension = embedding_dimension
        self.append_to_corpora = append_to_corpora
        self.file_path = file_to_ingest

        self.text: Dict[str, List[str]] = {} # keys as text columns names and values as list of strings comprising the columns. 

    def prepare_db(self):

        db = sqlite3.connect("mercury.sqlite")
        db.enable_load_extension(True)
        sqlite_vec.load(db)
        db.enable_load_extension(False)

        if not self.append_to_corpora:
            db.execute("DROP TABLE IF EXISTS corpus")
            db.execute("DROP TABLE IF EXISTS embeddings")

            # table 1: text chunks
            # columns: 
            # the id of the chunk, the id of the sample, the type of the chunk, the text of the chunk 
            command_create_chunks = "CREATE TABLE chunks (chunk_id INTEGER PRIMARY KEY, sample_id int, offset int, length int, type TEXT, chunk TEXT)"
            db.execute(command_create_chunks)

            # table 2: embeddings of chunks 

            db.execute(f"CREATE VIRTUAL TABLE embeddings USING vec0(embedding float[{self.embedding_dimension}])") # the embedding of text chunks  

    def load_data_for_ingestion(self) -> Tuple[List[str], List[str]]:
        # if file_to_ingest ends with JSONL, load it as JSONL
        if self.file_path.endswith("jsonl"):
            df = pandas.read_json(self.file_path, lines=True)
        elif self.file_path.endswith("json"):
            df = pandas.read_json(self.file_path)
        elif self.file_path.endswith("csv"):
            df = pandas.read_csv(self.file_path)
        else:
            raise Exception(f"Unsupported file format in {self.file_path}")
        
        df.columns = df.columns.str.lower()

        sources = df["source"].tolist()
        summaries = df["summary"].tolist()

        self.text['source'] = sources
        self.text['summary'] = summaries
        return sources, summaries 
    
    def ingest_to_corpora(self, batch_size: int = 4):
        """Chunk the data and ingest it to the the db table corpora"""

        for text_type, docs in self.text.items():
            for i in range(0, len(docs), batch_size):
                local_chunks = 



        

    def ingest_to_corpora(self):
        sources, summaries = self.load_data_for_ingestion()
        for index, (source, summary) in tqdm(
            enumerate(zip(sources, summaries)),
            total=len(sources),
            desc="Ingesting data to Vectara",
        ):
            id_ = f"mercury_{index}"
            for column in ["source", "summary"]:
                # The name "column" does not indicate the column name, but the type of text
                text = source if column == "source" else summary
                corpus_id = (
                    self.source_corpus_id
                    if column == "source"
                    else self.summary_corpus_id
                )
                text_info = self.split_text_into_chunks(text)
                self.vectara_client.create_document_from_chunks(
                    corpus_id=corpus_id,
                    chunks=text_info["chunks"],
                    chunk_metadata=text_info["chunk_metadata"],  # type: ignore
                    doc_id=id_,
                    doc_metadata={"type": column, "text": text},
                )

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

    def main(self):  # or become __call__
        return self.ingest_to_corpora()


# client = BetterVectara()
# a = client.read_corpus([13], read_filter_attributes=True)
# print(a)

if __name__ == "__main__":
    import argparse
    import os

    def get_env_id_value(env_name: str) -> int | None:
        env = os.environ.get(env_name, None)
        if env is not None:
            return int(env)
        return None

    parser = argparse.ArgumentParser()
    parser.add_argument("file_to_ingest", type=str, help="Path to the file to ingest")
    parser.add_argument(
        "--source_corpus_id",
        type=int,
        help="Source Corpus ID",
        default=get_env_id_value("SOURCE_CORPUS_ID"),
    )
    parser.add_argument(
        "--summary_corpus_id",
        type=int,
        help="Summary Corpus ID",
        default=get_env_id_value("SUMMARY_CORPUS_ID"),
    )
    parser.add_argument(
        "--annotation_corpus_id",
        type=int,
        help="Annotation Corpus ID",
        default=get_env_id_value("ANNOTATION_CORPUS_ID"),
    )
    parser.add_argument(
        "--overwrite_corpora",
        action="store_true",
        help="Whether to overwrite existing corpora",
    )
    args = parser.parse_args()

    print("Uploading data to Vectara...")
    ingester = Ingester(
        file_to_ingest=args.file_to_ingest,
        source_corpus_id=args.source_corpus_id,
        summary_corpus_id=args.summary_corpus_id,
        annotation_corpus_id=args.annotation_corpus_id,
        overwrite_corpora=args.overwrite_corpora,
    )
    ingester.main()

    print(f"Uploaded!")

    if (
        not args.source_corpus_id
        or not args.summary_corpus_id
        or not args.annotation_corpus_id
    ):
        print("Please add the following lines to your .env file:")
        if not args.source_corpus_id:
            print(f"SOURCE_CORPUS_ID={ingester.source_corpus_id}")
        if not args.summary_corpus_id:
            print(f"SUMMARY_CORPUS_ID={ingester.summary_corpus_id}")
        if not args.annotation_corpus_id:
            print(f"ANNOTATION_CORPUS_ID={ingester.annotation_corpus_id}")
