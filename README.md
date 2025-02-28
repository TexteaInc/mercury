# Mercury

Mercury is a semantic-assisted, cross-text text labeling tool.

1. semantic-assisted: when you select a text span, semantically related text segments will be highlighted -- so you don't have to eyeball through lengthy texts.
2. cross-text: you are labeling text spans from two different texts.

Therefore, Mercury is very efficient for the labeling of NLP tasks that involve comparing texts between two documents which are also lengthy, such as hallucination detection or factual consistency/faithfulness in RAG systems. Semantic assistance not only saves time and reduces fatigues but also avoids mistakes.

Currently, Mercury only supports labeling inconsistencies between the source and summary for summarization in RAG.

![Header](usage/selection_from_highlight.png)

## Dependencies and setup

> [!NOTE]
> You need Python and Node.js.

Mercury uses [`sqlite-vec`](https://github.com/asg017/sqlite-vec) to store and search embeddings.

1. `pip3 install -r requirements.txt && python3 -m spacy download en_core_web_sm`

2. If you don't have `pnpm` installed, please install with `npm install -g pnpm` - you may need `sudo`. If you don't have `npm`, try `sudo apt install npm`.

3. Compile the frontend: `pnpm install && pnpm build`

4. To use `sqlite-vec` via Python's built-in `sqlite3` module, you must have SQLite>3.41 (otherwise `LIMIT` or `k=?` will not work properly with `rowid IN (?)` for vector search) installed and ensure Python's built-in `sqlite3` module is built for SQLite>3.41. Note that Python's built-in `sqlite3` module uses its own binary library that is independent of the OS's SQLite. So upgrading the OS's SQLite will not upgrade Python's `sqlite3` module.
   To manually upgrade Python's `sqlite3` module to use SQLite>3.41, here are the steps:
    * Download and compile SQLite>3.41.0 from source

         ```bash
         wget https://www.sqlite.org/2024/sqlite-autoconf-3460100.tar.gz 
         tar -xvf sqlite-autoconf-3460100.tar.gz
         cd sqlite-autoconf-3460100
         ./configure
         make
         ```

    * Set Python's built-in `sqlite3` module to use the compiled SQLite.
      Suppose you are currently at path `$SQLITE_Compile`. Then set this environment variable (feel free to replace
      `$SQLITE_Compile` with the actual absolute/relative path):

        ```bash
        export LD_PRELAOD=$SQLITE_Compile/.libs/libsqlite3.so
        ```

      You may add the above line to `~.bashrc` to make it permanent.
    * Verify that Python's `sqlite3` module is using the correct SQLite, run this Python code:

      ```shell
      python3 -c "import sqlite3; print(sqlite3.sqlite_version)"
      ```

      If the output is the version of SQLite you just compiled, you are good to go.
    * If you are using Mac and run into troubles, please follow
      SQLite-vec's [instructions](https://alexgarcia.xyz/sqlite-vec/python.html#updated-sqlite).

5. To use `sqlite-vec` directly in `sqlite` prompt, simply [compile
   `sqlite-vec` from source](https://alexgarcia.xyz/sqlite-vec/compiling.html) and load the compiled `vec0.o`. The usage
   can be found in the SQLite-vec's [README](https://github.com/asg017/sqlite-vec?tab=readme-ov-file#sample-usage).

## Usage

1. Ingest data for labeling

   Run `python3 ingester.py -h` to see the options.

   The ingester takes a CSV, JSON, or JSONL file and loads texts from two text columns (configurable via option `ingest_column_1` and `ingest_column_2` which default to `source` and `summary`) of the file. After ingestion, the data will be stored in the SQLite database, denoted as `CORPUS_DB` in the following steps.

2. Manually set the labels for annotators to choose from in the `labels.yaml` file. Mercury supports hierarchical labels.
3. Generate and set a JWT secret key: `export SECRET_KEY=$(openssl rand -base64 32)`. You can rerun the command above to generate a new secret key when needed, especially when the old one is compromised. Note that changing the JWT token will log out all users. Optionally, you can also set `EXPIRE_MINUTES` to change the expiration time of the JWT token. The default is 7 days (10080 minutes).
4. Start the Mercury annotation server: `python3 server.py --corpus_db {CORPUS_DB} --user_db {USER_DB}`.

   Be sure to set the candidate labels to choose from in the `labels.yaml` file. The server will run on `http://localhost:8000` by default. The default `USER_DB`, namely `users.sqlite`, is distributed with the code repo with the default Email and password as `test@example.com` and `test`, respectively.
5. **Optional** To add/update/list users in a `USER_DB`, see [User administration in Mercury](user_admin.md) for more details.

The annotations are stored in the `annotations` table in a SQLite database (hardcoded name `mercury.sqlite`). See the
section [`annotations` table](#annotations-table-the-human-annotations) for the schema.

The dumped human annotations are stored in a JSON format like this:

```python
[
    {  # first sample 
        'sample_id': int,
        'source': str,
        'summary': str,
        'annotations': [  # a list of annotations from many human annotators
            {
                'annot_id': int,
                'sample_id': int,  # relative to the ingestion file
                'annotator': str,  # the annotator unique id
                'annotator_name': str,  # the annotator name
                'label': list[str],
                'note': str,
                'summary_span': str,  # the text span in the summary
                'summary_start': int,
                'summary_end': int,
                'source_span': str,  # the text span in the source
                'source_start': int,
                'source_end': int,
            }
        ],
        'meta_field_1': Any,  # whatever meta info about the sample
        'meta_field_2': Any,
        ...
    },
    {  # second sample
        ...
    },
    ...
]
```

You can view exported data in `http://[your_host]/viewer`

### Migrating data from old version

```bash
python3 migrator.py export --workdir {DIR_OF_SQLITE_FILES} --csv unified_users.csv 
python3 migrator.py register --csv unified_users.csv --db unified_users.sqlite
```

## Technical details

Terminology:

* A **sample** is a pair of source and summary.
* A **document** is either a source or a summary.
* A **chunk** is a sentence in a document.

> [!NOTE] SQLite uses 1-indexed for `autoincrement` columns while the rest of the code uses 0-indexed.

### Tables

Mercury needs two SQLite databases, denoted as `MERCURY_DB`, which stores a corpus for annotation, and `USER_DB`, which stores login credentials. One `USER_DB` can be reused for multiple `MERCURY_DB`s for the same group of users to annotation different corpora.

#### User database (`USER_DB`)

#### `users` table: the annotators

| user_id                          | user_name | email         | hashed_password |
|----------------------------------|-----------|---------------|-----------------|
| add93a266ab7484abdc623ddc3bf6441 | Alice     | <a@example.com> | super_safe      |
| 68d41e465458473c8ca1959614093da7 | Bob       | <b@example.com> | my_password     |

* The column`user_name` in `users` table is not unique and are not used as part of login credentials. An annotator logs in using a combination of  `email` and `hashed_password`.
* Password is hashed by `argon2` with parameters `time_cost=2, memory_cost=19456, parallelism=1`. This is recommended by [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id).

#### Mercury main database (`MERCURY_DB`)

Tables: `chunks`, `annotations`, `config`.

All powered by SQLite. In particular, `chunks` is powered by `sqlite-vec`.

#### `chunks` table: chunks, embeddings, and metadata

Each row is a chunk.

A JSONL file like this:

```jsonl
# test.jsonl
{"source": "The quick brown fox. Jumps over a lazy dog. ", "summary": "26 letters."}
{"source": "We the people. Of the U.S.A. ", "summary": "The U.S. Constitution. It is great. "}
```

will be ingested into the `chunks` table as below:

| chunk_id | text                       | text_type | sample _id | char _offset | chunk _offset | embedding |
|----------|----------------------------|-----------|------------|--------------|---------------| --------- |
| 0        | "The quick brown fox."     | source    | 0          | 0            | 0             | [0.1, 0.2, ..., 0.9] |
| 1        | "Jumps over the lazy dog." | source    | 0          | 21           | 1             | [0.1, 0.2, ..., 0.9] |
| 2        | "We the people."           | source    | 1          | 0            | 0             | [0.1, 0.2, ..., 0.9] |
| 3        | "Of the U.S.A."            | source    | 1          | 15           | 1             | [0.1, 0.2, ..., 0.9] |
| 4        | "26 letters."              | summary   | 0          | 0            | 0             | [0.1, 0.2, ..., 0.9] |
| 5        | "The U.S. Constitution."   | summary   | 1          | 0            | 0             | [0.1, 0.2, ..., 0.9] |
| 6        | "It is great."             | summary   | 1          | 23           | 1             | [0.1, 0.2, ..., 0.9] |

Meaning of select columns:

* `char_offset` is the offset of a chunk in its parent document measured by the starting character of the chunk. It
  allows us to find the chunk in the document.
* `chunk_offset_local` is the index of a chunk in its parent document. It is used to find the chunk in the document.
* `text_type` is takes value from the ingestion file. `source` and `summary` for now.
* All columns are 0-indexed.
* The `sample_id` is the index of the sample in the ingestion file. Because the ingestion file could be randomly sampled
  from a bigger dataset, the `sample_id` is not necessarily global.
* `embedding` is the embedding of the chunk.

#### `annotations` table: the human annotations

| annot_id | sample _id | annot_spans                             | annotator | label          | note                           |
|----------|------------|-----------------------------------------|-----------|----------------|--------------------------------|
| 1        | 1          | {'source': [1, 10], 'summary': [7, 10]} | 2fe9bb69  | ["ambivalent"] | "I am not sure."               |
| 2        | 1          | {'summary': [2, 8]}                     | a24cb15c  | ["extrinsic"]  | "No connection to the source." |

* `sample_id` are the `id`'s of chunks in the `chunks` table.
* `text_spans` is a JSON text field that stores the text spans selected by the annotator. Each entry is a dictionary
  where keys must be those in the `text_type` column in the `chunks` table (hardcoded to  `source` and `summary` now)
  and the values are lists of two integers: the start and end indices of the text span in the chunk. For extrinsic
  hallucinations (no connection to the source at all), only `summary`-key items. The reason we use JSON here is that
  SQLite does not support array types.

#### `config` table: the configuration

For example:

| key                | value                           |
|--------------------|---------------------------------|
| embdding_model     | "openai/text-embedding-3-small" |
| embdding_dimension | 4                               |

#### `sample_meta` table: the sample metadata

| sample_id | json_meta                                                                                                                                                                                                       |
|-----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0         | {"model":"meta-llama\/Meta-Llama-3.1-70B-Instruct","HHEMv1":0.43335,"HHEM-2.1":0.39717,"HHEM-2.1-English":0.90258,"trueteacher":1,"true_nli":0.0,"gpt-3.5-turbo":1,"gpt-4-turbo":1,"gpt-4o":1, "sample_id":727} |
| 1         | {"model":"openai\/GPT-3.5-Turbo","HHEMv1":0.43003,"HHEM-2.1":0.97216,"HHEM-2.1-English":0.92742,"trueteacher":1,"true_nli":1.0,"gpt-3.5-turbo":1,"gpt-4-turbo":1,"gpt-4o":1, "sample_id": 1018}                 |

0-indexed, the `sample_id` column is the `sample_id` in the `chunks` table. It is local to the ingestion file. The
`json_meta` is whatever info other than ingestion columns (source and summary) in the ingestion file.

### Authentication

Mercury implemented a simple OAuth2 authentication. The user logs in with email and password. The server will return a
signed JWT token. The server will verify the token for each request. The token will expire in 7 days.

### How to do vector search

SQLite-vec uses Euclidean distance for vector search. So all embeddings much be normalized to unit length. Fortunately,
OpenAI and Sentence-Bert's embeddings are already normalized.

1. Suppose the user selects a text span in sample of sample ID `x`.
2. Get the type of the opposite document (source if `x` is in summary, and vice versa).
3. Get the `embedding` of the selected text span.
4. Send a query to SQLite like this:

   ```sql
      SELECT chunk_id, distance FROM chunks WHERE k = 5 AND sample_id = {x} AND text_type = {text_type} AND embedding MATCH '{embedding}' ORDER BY distance
    ```

   This will find the 5 most similar chunks to `x` in the opposite document. Note that `embedding` and `distance` are predefined by
   `sqlite-vec`.

Here is a running example (using the data [above](#chunks-table-chunks-and-metadata)):

1. Suppose the data has been ingested. The embedder is `openai/text-embedding-3-small` and the embedding dimension is `512`.
2. Suppose the user selects `sample_id = 1` : "The U.S. Constitution." The `text_type` of this span is `summary` -- the opposite document is the source.
3. Get the embedding of "The U.S. Constitution".

   ```python
   embedding = embedder.embed(["The U.S. Constitution."], embedding_dimension=512)[0]
   ```

4. Send a query to SQLite:

   ```sql
   SELECT chunk_id, distance FROM chunks WHERE k = 5 AND sample_id = 1 AND text_type = 'source' AND embedding MATCH '{embedding}' ORDER BY distance
   ```

   The return is `[(2, 0.20000001788139343), (1, 0.40000003576278687)]`.

5. Get the text spans of the chunks with `chunk_id` 2 and 1.

   ```sql
   SELECT chunk_id, text, char_offset FROM chunks WHERE chunk_id in (2, 1)
   ```

   The return is `[(2, 'We the people.', 0), (1, 'Of the U.S.A.', 15)]`.

6. The closest source chunk is "We the people" (`chunk_id`=2) which is the most famous three words in the US Constitution.

### Limitations

1. OpenAI's embedding endpoint can only embed up to 8192 tokens in each call.
2. `embdding_dimension` is only useful for OpenAI models. Most other models do not support changing the embedding
   dimension.

### Embedding speed and/or embedding dimension

1. `multi-qa-mpnet-base-dot-v1` takes about 0.219 second on an x86 CPU to embed one sentence when batch_size is 1. The
   embedding dimension is 768.
2. `BAAI/bge-small-en-v1.5` takes also about 0.202 second on an x86 CPU to embed one sentence when batch_size is 1. The
   embedding dimension is 384.
