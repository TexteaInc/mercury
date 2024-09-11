# Features that Forrest's vectara Python SDK does not provide
# TO be added to the Vectara Python SDK shortly
import json
from typing import Any

import requests
from vectara import Vectara


class BetterVectara(Vectara):
    def read_corpus(
        self,
        corpusIds: list[int],
        read_basic_info: bool = True,
        read_size: bool = False,
        read_api_keys: bool = False,
        read_custom_dimensions: bool = False,
        read_filter_attributes: bool = False,
    ):
        url = f"{self.base_url}/v1/read-corpus"

        headers = {"customer-id": self.customer_id}

        if self.api_key:
            headers["x-api-key"] = self.api_key
        else:
            headers["Authorization"] = f"Bearer {self.jwt_token}"

        payload = {
            "corpusId": corpusIds,
            "readBasicInfo": read_basic_info,
            "readSize": read_size,
            "readApiKeys": read_api_keys,
            "readCustomDimensions": read_custom_dimensions,
            "readFilterAttributes": read_filter_attributes,
        }

        response = requests.post(url, headers=headers, data=json.dumps(payload))

        return response.json()

    def create_corpus_with_metadata_filters(
        self,
        corpus_name: str,
        corpus_description: str = "",
        metadata_filters: list[dict] = [],
    ):
        url = f"{self.base_url}/v1/create-corpus"

        filter_attributes = []

        for metadata_filter in metadata_filters:
            filter_attributes.append(
                {
                    "name": metadata_filter["name"],
                    "description": "",
                    "indexed": metadata_filter["indexed"],
                    "type": metadata_filter["type"].value,
                    "level": metadata_filter["level"].value,
                }
            )

        payload = json.dumps(
            {
                "corpus": {
                    "name": corpus_name,
                    "description": corpus_description,
                    "filterAttributes": filter_attributes,
                }
            }
        )

        headers = {"customer-id": self.customer_id}

        if self.api_key:
            headers["x-api-key"] = self.api_key
        else:
            headers["Authorization"] = f"Bearer {self.jwt_token}"

        response = requests.post(url, headers=headers, data=payload)

        if response.status_code == 200:
            return response.json()["corpusId"]
        else:
            raise Exception(f"Failed to create corpus: {response.text}")

    def list_documents_with_filter(
        self,
        corpus_id: int,
        numResults: int = 10,
        pageKey: str | None = None,
        metadataFilter: str | None = None,
    ) -> dict:
        url = f"{self.base_url}/v1/list-documents"

        headers = {}

        if self.api_key:
            headers["x-api-key"] = self.api_key
        else:
            headers["Authorization"] = f"Bearer {self.jwt_token}"

        payload: dict[str, Any] = {"corpusId": corpus_id, "numResults": numResults}

        if pageKey:
            payload["pageKey"] = pageKey

        if metadataFilter:
            payload["metadataFilter"] = metadataFilter

        response = requests.post(url, headers=headers, data=json.dumps(payload))

        return response.json()

    def list_all_documents(self, corpus_id: int, metadataFilter: str | None = None):
        pageKey: str | None = None
        while True:
            page = self.list_documents_with_filter(
                corpus_id,
                numResults=1000,
                pageKey=pageKey,
                metadataFilter=metadataFilter,
            )
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
