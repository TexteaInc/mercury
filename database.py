import os
import uuid
from typing import TypedDict, List, Dict, NamedTuple
import json

from better_vectara import BetterVectara as Vectara
from dotenv import load_dotenv

class LabelData(NamedTuple): # human annotation on a sample
    def __init__(self,
        sample_id: str, # renamed from task_id
        summary_start: int,
        summary_end: int,
        source_start: int,
        source_end: int,
        consistent: bool,
        user_id: str,
        task_index: int # TODO: do we need task_index?
    ):
        self.sample_id = sample_id
        self.summary_start = summary_start
        self.summary_end = summary_end
        self.source_start = source_start
        self.source_end = source_end
        self.consistent = consistent
        self.user_id = user_id
        self.task_index = task_index

# def parse_documents_to_label_data_list(
def fetch_annotations_from_corpus(
    client: Vectara, source_id: int
) -> List[LabelData]:
    
    print("Getting all documents from database for fast checking...")    
    data_list = []
    for doc in client.list_all_documents(client, source_id):
        # print(doc)
        data_list.append(LabelData(**doc["metadata"]))
    return data_list

class Database:
    def __init__(self, 
        annotation_corpus_id: int, 
        vectara_client: Vectara = Vectara()
        ):
        
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
            corpus_id= self.annotation_corpus_id,
            chunks=["NO CHUNKS"],
            doc_id="no_need_" + uuid.uuid4().hex,
            doc_metadata=label_data._asdict(),
        )

    def export_user_data(self, user_id: str) -> list[LabelData]:
        return [label_data for label_data in self.annotations if label_data["user_id"] == user_id]

    def dump_all_data(self, 
            dump_file: str = "mercury_annotatins.json",
            source_corpus_id: int = None, #TODO: include full-text source and summary in the dump
            summary_corpus_id: int = None
        ):
        to_dump = [x._asdict() for x in self.annotations]
        with open(dump_file, "w") as f:
            f.write(json.dumps(to_dump, indent=2, sort_keys=True, ensure_ascii=False))
                
        return self.documents


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Dump all annotations from a Vectara corpus to a JSON file."
    )
    parser.add_argument("--annotation_corpus_id", type=int, required=True)
    parser.add_argument("--dump_file", type=str, default="mercury_annotations.json")
    args = parser.parse_args()

    load_dotenv()
    db = Database(args.annotation_corpus_id)
    print (f"Dumping all data to {args.dump_file}")
    db.dump_all_data(args.dump_file)
