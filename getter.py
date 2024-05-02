__all__ = ["get_full_documents", "list_all_documents"]

import os

import vectara
from dotenv import load_dotenv


def list_all_documents(client: vectara.vectara, corpus_id: int):
    pageKey: str | None = None
    while True:
        page = client.list_documents(corpus_id, numResults=1000, pageKey=pageKey)
        if page["document"] == []:
            yield from page["document"]
            break
        else:
            yield from page["document"]
            pageKey = page["nextPageKey"]
            if pageKey:
                continue
            else:
                break


class Getter:
    def __init__(self):
        load_dotenv()
        self.client = vectara.vectara()
        self.source_id = int(os.environ.get("MERCURY_SOURCE_ID", -1))
        self.summary_id = int(os.environ.get("MERCURY_SUMMARY_ID", -1))
        if self.source_id == -1 or self.summary_id == -1:
            print("Failed to get corpus id")
            print(
                "Please set MERCURY_SOURCE_ID and MERCURY_SUMMARY_ID later in the .env file"
            )
            self.source_id = int(input("Enter source corpus id (temp): "))
            self.summary_id = int(input("Enter summary corpus id (temp): "))

    def get_full_documens(self):
        tasks = []
        tmps_tasks = {}

        def push_to_tmps_tasks(id_, source, summary):
            if id_ not in tmps_tasks:
                tmps_tasks[id_] = {"source": source, "summary": summary}
            else:
                if source:
                    tmps_tasks[id_]["source"] = source
                if summary:
                    tmps_tasks[id_]["summary"] = summary

        for doc in list_all_documents(self.client, self.source_id):
            id_ = doc["id"]
            for meta in doc["metadata"]:
                if meta["name"] == "full":
                    push_to_tmps_tasks(id_, meta["value"], None)
                    break
        for doc in list_all_documents(self.client, self.summary_id):
            id_ = doc["id"]
            for meta in doc["metadata"]:
                if meta["name"] == "full":
                    push_to_tmps_tasks(id_, None, meta["value"])
                    break
        for id_, task in tmps_tasks.items():
            tasks.append(
                {"_id": id_, "source": task["source"], "summary": task["summary"]}
            )
        return self.source_id, self.summary_id, tasks


def get_full_documents():
    getter = Getter()
    return getter.get_full_documens()
