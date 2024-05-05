import os
import uuid
from typing import TypedDict

import vectara
from dotenv import load_dotenv

from getter import list_all_documents


class LabelData(TypedDict):
    task_id: str
    summary_start: int
    summary_end: int
    source_start: int
    source_end: int
    consistent: bool
    task_index: int
    user_id: str


def parse_documents_to_label_data_list(
    client: vectara.vectara, source_id: int
) -> list[LabelData]:
    data_list = []
    for doc in list_all_documents(client, source_id):
        # print(doc)
        for meta in doc["metadata"]:
            if meta["name"] == "raw_request":
                data_list.append(small_to_label_data(meta["value"]))
                break
    return data_list


def label_data_to_small(data: LabelData) -> str:
    return f"{data['task_id']},{data['summary_start']},{data['summary_end']},{data['source_start']},{data['source_end']},{data['consistent']},{data['user_id']},{data['task_index']}"


def small_to_label_data(small: str) -> LabelData:
    parts = small.split(",")
    return {
        "task_id": parts[0],
        "summary_start": int(parts[1]),
        "summary_end": int(parts[2]),
        "source_start": int(parts[3]),
        "source_end": int(parts[4]),
        "consistent": parts[5] == "True",
        "user_id": parts[6],
        "task_index": int(parts[7]),
    }


class Database:
    def __init__(self):
        load_dotenv()

        self.database_id = int(os.environ.get("ANNOTATION_CORPUS_ID", -1))

        if self.database_id == -1:
            raise Exception("Annotation ID not found in environment variables.")

        self.client = vectara.vectara()

        print("Getting all documents from database for fast checking...")
        self.documents = parse_documents_to_label_data_list(
            self.client, self.database_id
        )
        # print(self.documents)

    def push_new_document(self, new_document: LabelData):
        if self.check_document_exists(new_document):
            return
        self.documents.append(new_document)
        self.client.create_document_from_chunks(
            corpus_id=self.database_id,
            chunks=["NO CHUNKS NEEDED FOR THIS DOCUMENT"],
            doc_id="no_need_" + uuid.uuid4().hex,
            doc_metadata={
                "user_id": new_document["user_id"],
                "task_id": new_document["task_id"],
                "raw_request": label_data_to_small(new_document),
            },
        )

    def check_document_exists(self, new_document: LabelData) -> bool:
        return new_document in self.documents

    def export_user_data(self, user_id: str) -> list[LabelData]:
        return [doc for doc in self.documents if doc["user_id"] == user_id]

    def dump_all_data(self):
        return self.documents


if __name__ == "__main__":
    database = Database()
    import json

    from getter import get_full_documents

    print("Dumping data to data.json")
    source_id, summary_id, tasks = get_full_documents()

    datas = []

    for data in database.dump_all_data():
        new_data = data.copy()
        new_data["summary_label"] = tasks[data["task_index"]]["summary"][data["summary_start"] : data["summary_end"]]  # type: ignore
        new_data["source_label"] = tasks[data["task_index"]]["source"][data["source_start"] : data["source_end"]]  # type: ignore
        datas.append(new_data)

    with open("data.json", "w") as f:
        json.dump(datas, f, indent=4, sort_keys=True, ensure_ascii=False)
