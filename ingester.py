import json
from enum import Enum
from typing import Dict, List, Literal, Tuple, TypedDict

import pandas
import requests
from dotenv import load_dotenv
from tqdm.auto import tqdm

from better_vectara import BetterVectara as Vectara


class FilterAttributeType(Enum):
    UNDEFINED = "FILTER_ATTRIBUTE_TYPE__UNDEFINED"
    INTEGER = "FILTER_ATTRIBUTE_TYPE__INTEGER"
    INTEGER_LIST = "FILTER_ATTRIBUTE_TYPE__INTEGER_LIST"
    REAL = "FILTER_ATTRIBUTE_TYPE__REAL"
    REAL_LIST = "FILTER_ATTRIBUTE_TYPE__REAL_LIST"
    TEXT = "FILTER_ATTRIBUTE_TYPE__TEXT"
    TEXT_LIST = "FILTER_ATTRIBUTE_TYPE__TEXT_LIST"
    BOOLEAN = "FILTER_ATTRIBUTE_TYPE__BOOLEAN"


class FilterAttributeLevel(Enum):
    UNDEFINED = "FILTER_ATTRIBUTE_LEVEL__UNDEFINED"
    DOCUMENT = "FILTER_ATTRIBUTE_LEVEL__DOCUMENT"
    DOCUMENT_PART = "FILTER_ATTRIBUTE_LEVEL__DOCUMENT_PART"


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

from vectara.data_types import Filter

load_dotenv()

annotation_metadata_filters = [
    {
        "name": "user_id",
        "indexed": True,
        "type": FilterAttributeType.TEXT,
        "level": FilterAttributeLevel.DOCUMENT,
    },
    {
        "name": "sample_id",
        "indexed": True,
        "type": FilterAttributeType.TEXT,
        "level": FilterAttributeLevel.DOCUMENT,
    },
    {
        "name": "summary_start",
        "indexed": True,
        "type": FilterAttributeType.INTEGER,
        "level": FilterAttributeLevel.DOCUMENT,
    },
    {
        "name": "summary_end",
        "indexed": True,
        "type": FilterAttributeType.INTEGER,
        "level": FilterAttributeLevel.DOCUMENT,
    },
    {
        "name": "source_start",
        "indexed": True,
        "type": FilterAttributeType.INTEGER,
        "level": FilterAttributeLevel.DOCUMENT,
    },
    {
        "name": "source_end",
        "indexed": True,
        "type": FilterAttributeType.INTEGER,
        "level": FilterAttributeLevel.DOCUMENT,
    },
    {
        "name": "consistent",
        "indexed": True,
        "type": FilterAttributeType.BOOLEAN,
        "level": FilterAttributeLevel.DOCUMENT,
    },
]


class CheckItem(TypedDict):
    type_: Literal["str", "float", "int", "bool"]
    has: bool


def create_annotation_metadata_check_dict() -> Dict[str, CheckItem]:
    check_dict = {}
    for annotation_metadata_filter in annotation_metadata_filters:
        match annotation_metadata_filter["type"]:
            case FilterAttributeType.TEXT:
                type_ = "str"
            case FilterAttributeType.INTEGER:
                type_ = "int"
            case FilterAttributeType.BOOLEAN:
                type_ = "bool"
            case _:
                type_ = "str"

        check_dict[annotation_metadata_filter["name"]] = {"type_": type_, "has": False}
    return check_dict


class Ingester:
    def __init__(
        self,
        file_to_ingest: str,
        source_corpus_id: int | None = None,
        summary_corpus_id: int | None = None,
        annotation_corpus_id: int | None = None,
        source_column_name: str = "source",
        summary_column_name: str = "summary",
        overwrite_corpora: bool = False,
    ):
        self.sources = None
        self.summaries = None
        vectara_client = Vectara()
        self.vectara_client = vectara_client
        self.file_path = file_to_ingest
        self.source_column_name = source_column_name
        self.summary_column_name = summary_column_name

        print("Overwrite corpora is set to: ", overwrite_corpora)

        # prepare three corpora for source, summary and annotation
        if source_corpus_id is None:
            print("Creating source corpus")
            id_temp = vectara_client.create_corpus("mercury_source")
            assert isinstance(id_temp, int)
            source_corpus_id = id_temp
            print("A new source corpus is created, with ID: ", source_corpus_id)
        else:
            if overwrite_corpora:
                print(f"Resetting source corpus with ID: {source_corpus_id}")
                vectara_client.reset_corpus(source_corpus_id)

        if summary_corpus_id is None:
            print("Creating summary corpus")
            id_temp = vectara_client.create_corpus("mercury_summary")
            assert isinstance(id_temp, int)
            summary_corpus_id = id_temp
            print("A new summary corpus is created, with ID: ", summary_corpus_id)
        else:
            if overwrite_corpora:
                print(f"Resetting summary corpus with ID: {summary_corpus_id}")
                vectara_client.reset_corpus(summary_corpus_id)

        if annotation_corpus_id is None:
            annotation_corpus_id = vectara_client.create_corpus_with_metadata_filters(
                "mercury_annotation",
                metadata_filters=annotation_metadata_filters,
            )
            print("A new annotation corpus is created, with ID: ", annotation_corpus_id)
        else:
            if overwrite_corpora:
                print(f"Resetting annotation corpus with ID: {annotation_corpus_id}")
                vectara_client.reset_corpus(annotation_corpus_id)
                print(f"Checking metadata filters for corpus {annotation_corpus_id}")
                response = vectara_client.read_corpus(
                    [annotation_corpus_id], read_filter_attributes=True
                )
                metadata_filters = response["corpora"][0]["filterAttribute"]
                check_list = create_annotation_metadata_check_dict()
                for metadata_filter in metadata_filters:
                    if metadata_filter["name"] in check_list:
                        check_list[metadata_filter["name"]]["has"] = True
                for name, check_item in check_list.items():
                    if not check_item["has"]:
                        print("Adding metadata filter for", name)
                        a_filter = Filter(
                            name=name, 
                            description = "",
                            type = check_item["type_"],
                            level = "doc"
                        )
                        vectara_client.set_corpus_filters(
                            corpus_id=annotation_corpus_id,
                            filters = [a_filter]
                        )

        self.source_corpus_id = source_corpus_id
        self.summary_corpus_id = summary_corpus_id
        self.annotation_corpus_id = annotation_corpus_id

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

        sources = df[self.source_column_name].tolist()
        summaries = df[self.summary_column_name].tolist()

        self.sources = sources
        self.summaries = summaries
        return sources, summaries

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
        "--source_column_name",
        type=str,
        help="The column name for the source text in file_to_ingest. Default: 'source'",
        default="source",
    )
    parser.add_argument(
        "--summary_column_name",
        type=str,
        help="The column name for the summary text in file_to_ingest. Default: 'summary'",
        default="summary",
    )
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
        help="If this flag is set, existing corpora will be reset before ingestion.",
    )


    args = parser.parse_args()

    print("Uploading data to Vectara...")
    ingester = Ingester(
        file_to_ingest=args.file_to_ingest,
        source_corpus_id=args.source_corpus_id,
        summary_corpus_id=args.summary_corpus_id,
        annotation_corpus_id=args.annotation_corpus_id,
        overwrite_corpora=args.overwrite_corpora,
        source_column_name=args.source_column_name,
        summary_column_name=args.summary_column_name
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
