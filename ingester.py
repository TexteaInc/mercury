import json
from enum import Enum
from typing import Dict, List, Literal, Tuple, TypedDict

import sqlite3, sqlite_vec
import spacy 
import pandas
import numpy as np

from dotenv import load_dotenv
from tqdm.auto import tqdm

import struct

load_dotenv()

def serialize_f32(vector: List[float]) -> bytes:
    """serializes a list of floats into a compact "raw bytes" format"""
    return struct.pack("%sf" % len(vector), *vector)

class Embedder: 
    def __init__(self, name: Literal['bge-small-en-v1.5', 'openai', 'multi-qa-mpnet-base-dot-v1']) -> None:
        self.name = name 
        self.use_sentence_transformers = False
        if name in ['bge-small-en-v1.5']:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(f'BAAI/{name}')
            self.use_sentence_transformers = True
        elif 'openai' in name:
            from openai import OpenAI
            self.model = OpenAI()
        elif name in ['multi-qa-mpnet-base-dot-v1']:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(f'sentence-transformers/{name}')
            self.use_sentence_transformers = True
    
    def embed(self, texts: List[str], embedding_dimension: int= 512,  batch_size:int = 12) -> np.ndarray:
        """The function that takes a list of strings and returns a numpy array of their embeddings.
        """
        if self.use_sentence_transformers:
            return self.model.encode(texts, batch_size=batch_size, normalize_embeddings=True)
        elif self.name == 'bge-m3':
            return self.model.encode(texts, batch_size=batch_size, max_length=512)['dense_vecs']
        elif "openai" in self.name:
            openai_model_id = self.name.split("/")[-1]
            response  = self.model.embeddings.create(input=texts, model=openai_model_id, dimensions=embedding_dimension)
            return np.array([item.embedding for item in response.data])
        else:
            # return dummy embeddings
            return np.random.rand(len(texts), embedding_dimension)

class Chunker: 
    def __init__(self):
        nlp = spacy.load("en_core_web_sm", exclude=["tok2vec",'tagger','parser','ner', 'attribute_ruler', 'lemmatizer'])
        nlp.add_pipe("sentencizer")
        self.nlp = nlp

    def chunk(self, text: str) -> List[List[str]]:
        return [sent.text for sent in self.nlp(text).sents]
        # return [[sent.text for sent in doc.sents ] for doc in self.nlp.pipe(texts)]

class Ingester:
    def __init__(
        self,
        file_to_ingest: str,
        overwrite_data: bool = False,
        embedding_dimension: int = 512,
        embedding_model_id: Literal["bge-m3", "openai/text-embedding-3-small", "openai/text-embedding-3-large", "sbert/multi-qa-mpnet-base-dot-v1", "dummy"] = "dummy",
        sqlite_db_path: str = "./mercury.sqlite",
        ingest_column_1: str = "source",
        ingest_column_2: str = "summary",
    ):
        self.file_to_ingest = file_to_ingest
        self.overwrite_data = overwrite_data
        self.sqlite_db_path = sqlite_db_path
        self.embedding_dimension = embedding_dimension
        self.embedding_model_id = embedding_model_id

        self.ingest_column_1 = ingest_column_1
        self.ingest_column_2 = ingest_column_2

        self.chunker = Chunker()
        self.embedder = Embedder(embedding_model_id)
        self.text = {}

    def prepare_db(self):
        self.db = sqlite3.connect(self.sqlite_db_path)
        self.db.enable_load_extension(True)
        sqlite_vec.load(self.db)
        self.db.enable_load_extension(False)

        if self.overwrite_data:
            self.db.execute("DROP TABLE IF EXISTS chunks")
            self.db.execute("DROP TABLE IF EXISTS embeddings")
            self.db.execute("DROP TABLE IF EXISTS config")
            self.db.commit()

        self.db.execute(
            "CREATE TABLE IF NOT EXISTS chunks (chunk_id INTEGER PRIMARY KEY, text TEXT, text_type TEXT, sample_id INTEGER, char_offset INTEGER, chunk_offset INTEGER)"
        )
        self.db.execute(
            f"CREATE VIRTUAL TABLE embeddings USING vec0(embedding float[{self.embedding_dimension}])"
        )
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)"
        )
        self.db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES ('embedding_model_id', ?)",
            [self.embedding_model_id],
        )
        self.db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES ('embedding_dimension', ?)",
            [self.embedding_dimension],
        )
        self.db.commit()

    def load_data_for_ingestion(self) -> Tuple[List[str], List[str]]:
        # if file_to_ingest ends with JSONL, load it as JSONL
        if self.file_to_ingest.endswith("jsonl"):
            df = pandas.read_json(self.file_to_ingest, lines=True)
        elif self.file_to_ingest.endswith("json"):
            df = pandas.read_json(self.file_to_ingest)
        elif self.file_to_ingest.endswith("csv"):
            df = pandas.read_csv(self.file_to_ingest)
        else:
            raise Exception(f"Unsupported file format in {self.file_to_ingest}")
        
        df.columns = df.columns.str.lower()

        sources = df[self.ingest_column_1].tolist()
        summaries = df[self.ingest_column_2].tolist()

        self.text[self.ingest_column_1] = sources
        self.text[self.ingest_column_2] = summaries
    
    def ingest(self):
        """Chunk the data, embed the chunks, and save to the database."""

        global_chunk_id = 1 # the id of the chunk in tables, starting from 1
        for text_type, docs in self.text.items():
            for sample_id in range(0, len(docs)): # simple, just chunk and embed one doc each time
                char_offset = 0
                chunks = self.chunker.chunk(docs[sample_id])
                embeddings = self.embedder.embed(chunks, embedding_dimension=self.embedding_dimension)
                for chunk_offset, chunk_text in enumerate(chunks):
                    print ([global_chunk_id, chunk_text, text_type, sample_id+1, char_offset, chunk_offset])
                    self.db.execute(
                        "INSERT INTO chunks (chunk_id, text, text_type, sample_id, char_offset, chunk_offset) VALUES (?, ?, ?, ?, ?, ?)",
                        [global_chunk_id, chunk_text, text_type, sample_id+1, char_offset, chunk_offset]
                    )
                    self.db.commit()
                    self.db.execute(
                        "INSERT INTO embeddings (rowid, embedding) VALUES (?, ?)",
                        [global_chunk_id, serialize_f32(embeddings[chunk_offset])]
                    )
                    self.db.commit()

                    char_offset += len(chunk_text) + 1 # +1 for the space between sentences. 
                    global_chunk_id += 1

    def main(self):  # or become __call__
        self.prepare_db()
        self.load_data_for_ingestion()
        self.ingest()

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
        "--overwrite_data",
        action="store_true",
        default=False,
        help="If True, overwrite the data store in database. If False (default), append to the existing data.",
    )
    parser.add_argument(
        "--embedding_model_id",
        type=str,
        default="dummy",
        help="The ID of the embedding model to usej. Currently supports 'multi-qa-mpnet-base-dot-v1', 'BAAI/bge-small-en-v1.5', 'openai/{text-embedding-3-small, text-embedding-3-large}', and 'dummy'.",
    )
    parser.add_argument(
        "--embedding_dimension",
        type=int,
        default=512,
        help="The dimension of the embeddings",
    )
    parser.add_argument(
        "--sqlite_db_path",
        type=str,
        default="./mercury.sqlite",
        help="The path to the SQLite database file",
    )
    parser.add_argument(
        "--ingest_column_1",
        type=str,
        default="source",
        help="The name of the 1st column to ingest",
    )
    parser.add_argument(
        "--ingest_column_2",
        type=str,
        default="summary",
        help="The name of the 2nd column to ingest",
    )

    args = parser.parse_args()

    print("Ingesting data")
    ingester = Ingester(
        file_to_ingest=args.file_to_ingest,
        overwrite_data=args.overwrite_data,
        embedding_dimension=args.embedding_dimension,
        embedding_model_id=args.embedding_model_id,
        sqlite_db_path=args.sqlite_db_path,
    )
    ingester.main()

    print(f"Ingested!")