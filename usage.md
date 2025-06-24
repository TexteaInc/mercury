# Usage

## Prepare the backend

1. You need an openai API key for ingesting data, set `OPENAI_API_KEY` in your environment variables. If you don't have one, you can use the other method.
2. Generate and set a JWT secret key: `export SECRET_KEY=$(openssl rand -base64 32)`, and save it. You can rerun the command above to generate a new secret key when needed, especially when the old one is compromised. Note that changing the JWT token will log out all users. Optionally, you can also set `EXPIRE_MINUTES` to change the expiration time of the JWT token. The default is 7 days (10080 minutes).
3. Your data must have two text columns, Mercury supports ingesting data from CSV, JSON, and JSONL files.
4. Install Python dependencies: `pip3 install -r requirements.txt && python3 -m spacy download en_core_web_sm`.
5. Now ingest your data: `python3 ingester.py --embedding_model_id=<embedding_model_id> --embedding_dimension=512 <path_to_your_data>`.
    1. `embedding_model_id` is the ID of the embedding model to use. Currently supports `all-mpnet-base-v2`, `multi-qa-mpnet-base-dot-v1`, `bge-small-en-v1.5`, `openai/{text-embedding-3-small, text-embedding-3-large}`, and `dummy` (random numbers).
    2. `embedding_dimension` is the dimension of the embeddings. Only effective to OpenAI embedders.
    3. `path_to_your_data` is the path to your data.
    4. If you want to overwrite the existing data, add `--overwrite_data` to the command.
    5. If your two text columns names are not `source` and `summary`, use the `ingest_column_1` (for Source) and `ingest_column_2` (for Summary) options, for example: `python ingester.py --embedding_model_id="openai/text-embedding-3-small" --embedding_dimension=512 --ingest_column_1="原文" --ingest_column_2="翻译" ./test.csv`
6. You need to set up the account: `python3 user_admin.py new -n "Test User" -e "test@example.com"`

## Start the server

Now that the backend is ready, there are two ways to start Mecury, so choose the one that best suits your needs.

### Docker

> [!NOTE]
> You may encounter issues with not being able to write to the database because of the permission issue, if so try using manual mode.

Install Docker Desktop and Docker Compose. See [Install](https://docs.docker.com/compose/install/) for more information.

1. Make `secrets` directory: `mkdir secrets`
2. Copy the `SECRET_KEY` env to `secrets/secret_key`, and copy the `OPENAI_API_KEY` env to `secrets/openai_api_key`.
3. Run: `docker compose up`

### Manual

1. Install Node.js and pnpm first, depending on your operating system, you can go to the official Node.js and pnpm websites for further details:
    1. [Node.js](https://nodejs.org/en/download/)
    2. [pnpm](https://pnpm.io/installation)
2. Install the dependencies: `pnpm install`
3. Build the frontend: `pnpm build`
4. Run the server: `python3 server.py`

## Label Interface

After the server is running, you can access the Mercury at `http://localhost:8000`.

WIP
