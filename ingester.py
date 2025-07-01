import json
from enum import Enum
from typing import Dict, List, Literal, Tuple, TypedDict

import sqlite3, sqlite_vec
import spacy 
import pandas
import numpy as np

from dotenv import load_dotenv
from tqdm.auto import tqdm
from version import __version__

import struct

load_dotenv()

def serialize_f32(vector: List[float]) -> bytes:
    """serializes a list of floats into a compact "raw bytes" format"""
    return struct.pack("%sf" % len(vector), *vector)

class Embedder: 
    def __init__(self, model_id: Literal['BAAI/bge-small-en-v1.5', 'openai/text-embedding-3-small', 'openai/text-embedding-3-large', 'sentence-transformers/all-mpnet-base-v2', 'sentence-transformers/multi-qa-mpnet-base-dot-v1', 'dummy']) -> None:
        self.model_id = model_id 
        if model_id in ['BAAI/bge-small-en-v1.5', 'sentence-transformers/multi-qa-mpnet-base-dot-v1', 'sentence-transformers/all-mpnet-base-v2']:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(model_id)
            self.use_sentence_transformers = True
        elif model_id in ['openai/text-embedding-3-small', 'openai/text-embedding-3-large']:
            from openai import OpenAI
            self.model = OpenAI()
        elif model_id == 'dummy':
            pass
        else: 
            print (f"Unsupported embedder {model_id}. Please check. ")
            exit() 
    
    def embed(self, texts: List[str], embedding_dimension: int= 512,  batch_size:int = 12) -> np.ndarray:
        """The function that takes a list of strings and returns a numpy array of their embeddings.
        """
        if self.model_id in ['BAAI/bge-small-en-v1.5', 'sentence-transformers/multi-qa-mpnet-base-dot-v1', 'sentence-transformers/all-mpnet-base-v2']:
            return self.model.encode(texts, batch_size=batch_size, normalize_embeddings=True)
        elif self.model_id in ['openai/text-embedding-3-small', 'openai/text-embedding-3-large']:
            openai_model_id = self.model_id.split("/")[-1]
            response  = self.model.embeddings.create(input=texts, model=openai_model_id, dimensions=int(embedding_dimension))
            return np.array([item.embedding for item in response.data])
        else:
            # return dummy embeddings
            print (f"Returning dummy embeddings")
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
        embedding_model_id: Literal["BAAI/bge-small-en-v1.5", "openai/text-embedding-3-small", "openai/text-embedding-3-large", "sentence-transformers/multi-qa-mpnet-base-dot-v1", "sentence-transformers/all-mpnet-base-v2", "dummy"] = "dummy",
        sqlite_db_path: str = "./mercury.sqlite",
    ):
        self.file_to_ingest = file_to_ingest
        self.overwrite_data = overwrite_data
        self.sqlite_db_path = sqlite_db_path

        self.embedding_dimension = embedding_dimension # only for openai models can you adjust the embedding dimension
        if embedding_model_id == "BAAI/bge-small-en-v1.5":
            self.embedding_dimension = 384
        elif embedding_model_id in ['sentence-transformers/all-mpnet-base-v2', 'sentence-transformers/multi-qa-mpnet-base-dot-v1']:
            self.embedding_dimension = 768
        elif embedding_model_id in ['openai/text-embedding-3-small', 'openai/text-embedding-3-large']:
            if embedding_dimension > 8_192:
                raise ValueError("OpenAI models only support up to 8192 dimensions")
            
        self.embedding_model_id = embedding_model_id

        self.chunker = Chunker()
        self.embedder = Embedder(embedding_model_id)
        self.text: Dict[str, List[str]] = {} # key as text column name, value as list of texts

    def prepare_db(self):
        first_time = not os.path.exists(self.sqlite_db_path)

        self.db = sqlite3.connect(self.sqlite_db_path)
        self.db.enable_load_extension(True)
        sqlite_vec.load(self.db)
        self.db.enable_load_extension(False)

        if self.overwrite_data:
            print ("\n************* BE CAREFUL *************")
            print (f"By turning on --overwrite_data, you chooose to remove all data (chunks, embeddings, and annotations) in the database file `{self.sqlite_db_path}`. Type UPPERCASE 'YES' if you still want to proceed.")
            answer = input()
            if answer == "YES":
                self.db.execute("DROP TABLE IF EXISTS chunks")
                self.db.execute("DROP TABLE IF EXISTS config")
                self.db.execute("DROP TABLE IF EXISTS annotations")
                # self.db.execute("DROP TABLE IF EXISTS leaderboard") # I don't know what this table is used for. -- Forrest, 2025-06-24
                # self.db.execute("DROP TABLE IF EXISTS users") # users are not in CORPUS_DB now. -- Forrest, 2025-06-24
                self.db.commit()

        # if embedding model changes, we must re-embed the data
        if not first_time and not self.overwrite_data and self.embedding_model_id != self.db.execute("SELECT value FROM config WHERE key = 'embedding_model_id'").fetchone()[0]:
            print (f"Embedding model in the CORPUS_DB {self.sqlite_db_path}: ", self.db.execute("SELECT value FROM config WHERE key = 'embedding_model_id'").fetchone()[0])
            print ("Embedding model set by you: ", self.embedding_model_id)
            print ("You changed the embedding model. Must re-embed the data. ")
            self.db.execute("DROP TABLE IF EXISTS chunks")
            self.db.commit()

        self.db.execute(
            f"CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING vec0(chunk_id INTEGER PRIMARY KEY, text TEXT, text_type TEXT, sample_id INTEGER, char_offset INTEGER, chunk_offset INTEGER, embedding float[{self.embedding_dimension}])"
        )
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY UNIQUE , value TEXT)"
        )
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS sample_meta (sample_id INTEGER PRIMARY KEY, json_meta TEXT)"
        )

        # Below commented by Forrest on 2024-09-28 because `users` is not used in ingestion but annotation
        # `users` initialization moved to `database.py`
        # self.db.execute(
        #     "CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, user_name TEXT)"
        # )

        self.db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES ('embedding_model_id', ?)",
            [self.embedding_model_id],
        )
        self.db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES ('embedding_dimension', ?)",
            [self.embedding_dimension],
        )
        self.db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES ('version', ?)",
            [__version__]
        )
        
        self.db.commit()

    def load_data_for_ingestion(self) -> Tuple[List[str], List[str]]:
        # if file_to_ingest ends with JSONL, load it as JSONL
        if self.file_to_ingest.endswith("jsonl"):
            df = pandas.read_json(self.file_to_ingest, lines=True)
        elif self.file_to_ingest.endswith("json"):
            df = pandas.read_json(self.file_to_ingest)
        else:
            raise Exception(f"Unsupported file format in {self.file_to_ingest}")
        
        df.columns = df.columns.str.lower()
        [text_1_name, text_2_name] = df.columns[0:2]
        # self.text[text_1_name]: List[str] = df[text_1_name].tolist()
        # self.text[text_2_name]: List[str] = df[text_2_name].tolist()
        self.text["text_1"]: List[str] = df[text_1_name].tolist() 
        self.text["text_2"]: List[str] = df[text_2_name].tolist()
        # Change the column names to text_1 and text_2 instead of the original column names 
        # -- Forrest, 2025-06-24

        self.db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES ('text_1_name', ?)",
            [text_1_name]
        )
        self.db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES ('text_2_name', ?)",
            [text_2_name]
        )
        self.db.commit()

        df_other_columns = df.drop(columns=[text_1_name, text_2_name])
        if len(df_other_columns.columns) > 0:
            sample_ids = range(0, len(self.text["text_1"]))
            json_meta = [row.to_json() for _, row in df_other_columns.iterrows()]
            cmd = "INSERT INTO sample_meta (sample_id, json_meta) VALUES (?, ?)"
            self.db.executemany(cmd, zip(sample_ids, json_meta))
            self.db.commit()
    
    def ingest(self):
        """Chunk the data, embed the chunks, and save to the database."""

        global_chunk_id = 0 # the id of the chunk in tables, starting from 1
        for text_type, docs in self.text.items():
            print (f"Processing {text_type}")
            for sample_id in tqdm(range(0, len(docs)), desc="Sample"): # simple, just chunk and embed one doc each time
                char_offset = 0
                chunks = self.chunker.chunk(docs[sample_id])
                embeddings = self.embedder.embed(chunks, embedding_dimension=self.embedding_dimension)
                for chunk_offset, chunk_text in enumerate(chunks):
                    # print ([global_chunk_id, chunk_text, text_type, sample_id+1, char_offset, chunk_offset])
                    self.db.execute(
                        "INSERT INTO chunks (chunk_id, text, text_type, sample_id, char_offset, chunk_offset, embedding) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [global_chunk_id, chunk_text, text_type, sample_id, char_offset, chunk_offset, serialize_f32(embeddings[chunk_offset])]
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

    parser = argparse.ArgumentParser(
        description="Ingest data to be annotated into the SQLite database",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("file_to_ingest", type=str, help="Path to the file to ingest")
    parser.add_argument(
        "--overwrite_data",
        action="store_true",
        default=False,
        help="If True, overwrite the $CORPUS_DB. If False (default), append to the existing data.",
    )
    parser.add_argument(
        "--embedding_model_id",
        type=str,
        default="dummy",
        help="The ID of the embedding model to use. Currently supports 'sentence-transformers/all-mpnet-base-v2', 'sentence-transformers/multi-qa-mpnet-base-dot-v1',  'BAAI/bge-small-en-v1.5', 'openai/{text-embedding-3-small, text-embedding-3-large}' (need to set env variables OPENAI_API_KEY), and 'dummy' (random numbers).",
    )
    parser.add_argument(
        "--embedding_dimension",
        type=int,
        default=512,
        help="The dimension of the embeddings. Only effective on OpenAI embedders. For OpenAI models, it cannot be larger than 8192.",
    )
    parser.add_argument(
        "--corpus_db",
        type=str,
        default="./mercury.sqlite",
        help="The path to the CORPUS_DB file",
    )
    parser.add_argument("--version", action="version", version="__version__")

    args = parser.parse_args()

    print("Mercury version: ", __version__)
    print("Ingesting data")
    ingester = Ingester(
        file_to_ingest=args.file_to_ingest,
        overwrite_data=args.overwrite_data,
        embedding_dimension=args.embedding_dimension,
        embedding_model_id=args.embedding_model_id,
        sqlite_db_path=args.sqlite_db_path
    )
    ingester.main()

    print(f"Ingested!")
