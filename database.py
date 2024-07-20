import json
import uuid
from typing import List, Literal, TypedDict

from dotenv import load_dotenv

from better_vectara import BetterVectara as Vectara


class LabelData(TypedDict):  # human annotation on a sample
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
        self.vectara_client = vectara_client
        self.annotation_corpus_id = annotation_corpus_id
        self.annotations: List[LabelData] = fetch_annotations_from_corpus(
            self.vectara_client, self.annotation_corpus_id
        )

    def push_annotation(self, label_data: LabelData):
        if label_data in self.annotations:
            return
        self.annotations.append(label_data)
        self.vectara_client.create_document_from_chunks(
            corpus_id=self.annotation_corpus_id,
            chunks=["NO CHUNKS"],
            doc_id="no_need_" + uuid.uuid4().hex,
            doc_metadata=label_data,  # type: ignore
        )

    def export_user_data(self, user_id: str) -> list[LabelData]:
        return [
            label_data
            for label_data in self.annotations
            if label_data["user_id"] == user_id
        ]

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
                            metadata["source_start"] : metadata["source_end"]
                        ],
                    },
                    "summary": {
                        "start": metadata["summary_start"],
                        "end": metadata["summary_end"],
                        "text": with_id[sample_id]["summary"][
                            metadata["summary_start"] : metadata["summary_end"]
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
