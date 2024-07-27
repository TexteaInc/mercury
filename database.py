import json
import uuid
from typing import List, Literal, TypedDict
import pandas as pd
import threading

from dotenv import load_dotenv

from better_vectara import BetterVectara as Vectara


class LabelData(TypedDict):  # human annotation on a sample
    record_id: str
    sample_id: str
    summary_start: int
    summary_end: int
    source_start: int
    source_end: int
    consistent: bool
    task_index: int
    user_id: str


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


def metadata_to_dict(metadata: list[dict]) -> dict:
    metadata_dict = {}
    for meta in metadata:
        if meta["name"] in LabelData.__annotations__:
            if LabelData.__annotations__[meta["name"]] is bool:
                metadata_dict[meta["name"]] = meta["value"] == "true"
            else:
                metadata_dict[meta["name"]] = LabelData.__annotations__[meta["name"]](
                    meta["value"]
                )
        else:
            metadata_dict[meta["name"]] = meta["value"]
    return metadata_dict


# def parse_documents_to_label_data_list(
def fetch_annotations_from_corpus(client: Vectara, source_id: int) -> List[LabelData]:
    print("Getting all documents from database for fast checking...")
    data_list = []
    for doc in client.list_all_documents(source_id):
        # print(doc)
        data_list.append(metadata_to_dict(doc["metadata"]))
    return data_list


class Database:
    def __init__(self, annotation_corpus_id: int, vectara_client: Vectara = Vectara()):
        self.lock = threading.Lock()
        self.vectara_client = vectara_client
        self.annotation_corpus_id = annotation_corpus_id
        annotation_records: List[LabelData] = fetch_annotations_from_corpus(
            self.vectara_client, self.annotation_corpus_id
        )
        self.annotations = pd.DataFrame.from_records(
            annotation_records,
            columns=["record_id", "sample_id", "summary_start", "summary_end", "source_start",
                     "source_end", "consistent", "task_index", "user_id"])

    @staticmethod
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
    def push_annotation(self, label_data: LabelData):
        if (
                (self.annotations["sample_id"] == label_data["sample_id"]) &
                (self.annotations["summary_start"] == label_data["summary_start"]) &
                (self.annotations["summary_end"] == label_data["summary_end"]) &
                (self.annotations["source_start"] == label_data["source_start"]) &
                (self.annotations["source_end"] == label_data["source_end"]) &
                (self.annotations["task_index"] == label_data["task_index"]) &
                (self.annotations["user_id"] == label_data["user_id"])
        ).any():
            return
        record_id = uuid.uuid4().hex
        label_data["record_id"] = record_id
        self.annotations.loc[len(self.annotations.index)] = (
            label_data["record_id"],
            label_data["sample_id"],
            label_data["summary_start"],
            label_data["summary_end"],
            label_data["source_start"],
            label_data["source_end"],
            label_data["consistent"],
            label_data["task_index"],
            label_data["user_id"],
        )
        self.vectara_client.create_document_from_chunks(
            corpus_id=self.annotation_corpus_id,
            chunks=["NO CHUNKS"],
            doc_id=record_id,
            doc_metadata=label_data,  # type: ignore
        )

    @database_lock()
    def export_user_data(self, user_id: str) -> list[LabelData]:
        return self.annotations[self.annotations["user_id"] == user_id].to_dict(orient="records")

    @database_lock()
    def dump_all_data(
            self,
            dump_file: str = "mercury_annotations.json",
            source_corpus_id: int | None = None,
            summary_corpus_id: int | None = None,
    ) -> list[AnnotationData]:
        if source_corpus_id is None or summary_corpus_id is None:
            raise ValueError("Source and Summary corpus IDs are required.")

        def get_source_and_summary_from_sample_id(sample_id: str) -> tuple[str, str]:
            source_response = self.vectara_client.list_documents_with_filter(
                corpus_id=source_corpus_id,
                numResults=1,
                pageKey=None,
                metadataFilter=f"doc.id = '{sample_id}'",
            )
            summary_response = self.vectara_client.list_documents_with_filter(
                corpus_id=summary_corpus_id,
                numResults=1,
                pageKey=None,
                metadataFilter=f"doc.id = '{sample_id}'",
            )
            if (
                    len(source_response["document"]) < 0
                    or len(summary_response["document"]) < 0
            ):
                raise ValueError(
                    f"Sample ID {sample_id} not found in source or summary corpus."
                )

            source_metadata = metadata_to_dict(
                source_response["document"][0]["metadata"]
            )
            summary_metadata = metadata_to_dict(
                summary_response["document"][0]["metadata"]
            )

            source = source_metadata["text"]
            summary = summary_metadata["text"]

            return source, summary

        result: list[AnnotationData] = []

        with_id: dict[str, AnnotationData] = {}

        id_source_summary: dict[str, dict[Literal["source", "summary"], str]] = {}

        for doc in self.vectara_client.list_all_documents(self.annotation_corpus_id):
            metadata = metadata_to_dict(doc["metadata"])
            sample_id = metadata["sample_id"]
            if sample_id not in id_source_summary:
                source, summary = get_source_and_summary_from_sample_id(sample_id)
                id_source_summary[sample_id] = {"source": source, "summary": summary}
            if sample_id not in with_id:
                with_id[sample_id] = {
                    "source": id_source_summary[sample_id]["source"],
                    "summary": id_source_summary[sample_id]["summary"],
                    "annotations": [],
                }
            with_id[sample_id]["annotations"].append(
                {
                    "source": {
                        "start": metadata["source_start"],
                        "end": metadata["source_end"],
                        "text": with_id[sample_id]["source"][
                                metadata["source_start"]: metadata["source_end"]
                                ],
                    },
                    "summary": {
                        "start": metadata["summary_start"],
                        "end": metadata["summary_end"],
                        "text": with_id[sample_id]["summary"][
                                metadata["summary_start"]: metadata["summary_end"]
                                ],
                    },
                    "consistent": metadata["consistent"],
                    "annotator": metadata["user_id"],
                }
            )

        for sample_id, data in with_id.items():
            result.append(
                {
                    "source": data["source"],
                    "summary": data["summary"],
                    "annotations": data["annotations"],
                }
            )

        with open(dump_file, "w") as f:
            json.dump(result, f, indent=4, ensure_ascii=False)

        return result

    @database_lock()
    def delete_annotation(self, record_id: str, user_id: str):
        if not (
                (self.annotations["record_id"] == record_id)
                & (self.annotations["user_id"] == user_id)
        ).any():
            return
        record_index = self.annotations[self.annotations["record_id"] == record_id].index
        self.annotations.drop(record_index, inplace=True)
        self.vectara_client.delete_document(self.annotation_corpus_id, record_id)


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
    parser.add_argument(
        "--source_corpus_id",
        type=int,
        default=get_env_id_value("SOURCE_CORPUS_ID"),
    )
    parser.add_argument(
        "--summary_corpus_id",
        type=int,
        default=get_env_id_value("SUMMARY_CORPUS_ID"),
    )
    parser.add_argument(
        "--annotation_corpus_id",
        type=int,
        default=get_env_id_value("ANNOTATION_CORPUS_ID"),
    )
    parser.add_argument("--dump_file", type=str, default="mercury_annotations.json")
    args = parser.parse_args()

    db = Database(args.annotation_corpus_id)
    print(f"Dumping all data to {args.dump_file}")
    db.dump_all_data(args.dump_file, args.source_corpus_id, args.summary_corpus_id)
