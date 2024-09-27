# Mercury

Mercury is a semantic-assisted, cross-text text labeling tool.

1. semantic-assisted: when you select a text span, semantically related text segments will be highlighted -- so you don't have to eyebal through lengthy texts.
2. cross-text: you are labeling text spans from two different texts.

Therefore, Mercury is very efficient for the labeling of NLP tasks that involve comparing texts between two documents which are also lengthy, such as hallucination detection or factual consistency/faithfulness in RAG systems. Semantic assistance not only saves time and reduces fatigues but also avoids mistakes.

Currently, Mercury only supports labeling inconsistencies between the source and summary for summarization in RAG.

![Header](.github/header.png)

## Dependencies

> [!NOTE]
> You need Python and Node.js.

Mercury uses [`sqlite-vec`](https://github.com/asg017/sqlite-vec) to store and search embeddings. 

1. `pip3 install -r requirements.txt && python3 -m spacy download en_core_web_sm`

2. If you don't have `pnpm` installed: `npm install -g pnpm`, you may need sudo. 

3. To use `sqlite-vec` via Python's built-in `sqlite3` module, you must have SQLite>3.41 (otherwise `LIMIT` or `k=?` will not work properly with `rowid IN (?)` for vector search) installed and set Python's built-in `sqlite3` module to use it. Python's built-in `sqlite3` module uses its own binary library that is independent of the OS's SQLite. So upgrading the OS's SQLite will not affect Python's `sqlite3` module. You need to follow the steps below:
   * Download and compile SQLite>3.41.0 from source
        ```bash
        wget https://www.sqlite.org/2024/sqlite-autoconf-3460100.tar.gz
        tar -xvf sqlite-autoconf-3460100.tar.gz
        cd sqlite-autoconf-3460100
        ./configure
        make
        ```
    * Set Python's built-in `sqlite3` module to use the compiled SQLite.
        Suppose you are currently at path `$SQLITE_Compile`. Then set this environment variable (feel free to replace `$SQLITE_Compile` with the actual absolute/relative path):

        ```bash
        export LD_PRELAOD=$SQLITE_Compile/.libs/libsqlite3.so
        ```

        You may add the above line to `~.bashrc` to make it permanent. 
    * Verify that Python's `sqlite3` module is using the correct SQLite, run this Python code:
      ```python
      python3 -c "import sqlite3; print(sqlite3.sqlite_version)"
      ```
      If the output is the version of SQLite you just compiled, you are good to go.
    * If you are using Mac and run into troubles, please follow SQLite-vec's [instructions](https://alexgarcia.xyz/sqlite-vec/python.html#updated-sqlite). 

4. To use `sqlite-vec` directly in `sqlite` prompt, simply [compile `sqlite-vec` from source](https://alexgarcia.xyz/sqlite-vec/compiling.html) and load the compiled `vec0.o`. The usage can be found in the [README](https://github.com/asg017/sqlite-vec?tab=readme-ov-file#sample-usage) of SQLite-vec. 

## Usage 

1. Ingest data for labeling

   Run `python3 ingester.py -h` to see the options.

   The ingester takes a CSV, JSON, or JSONL file and loads texts from two text columns (configurable via option `ingest_column_1` and `ingest_column_2` which default to `source` and `summary`) of the file. Mercury uses three Vectara corpora to store the sources, the summaries, and the human annotations. You can provide the corpus IDs to overwrite or append data to existing corpora.

2. `pnpm install && pnpm build` (You need to recompile the frontend each time the UI code changes.)
4. Manually set the labels for annotators to choose from in the `labels.yaml` file. Mercury supports hierarchical labels. 
3. `python3 server.py`. Be sure to set the candidate labels to choose from in the `server.py` file.

The annotations are stored in the `annotations` table in a SQLite database (hardcoded name `mercury.sqlite`). See the section [`annotations` table](#annotations-table-the-human-annotations) for the schema.

The dumped human annotations are stored in a JSON format like this:

```python
[
    {# first sample 
        'source': str, 
        'summary': str,
        'annotations': [ # a list of annotations from many human annotators
            {
                'source': {
                    'text': str,  # text span
                    'start': int, # charater offset
                    'end': int,   # character offset
                },
                'summary': {
                    'text': str,
                    'start': int,
                    'end': int
                },
                'label': list[str],
                'annotator': str
            }
        ]
    }
]
```

## Technical details

Terminology:
* A **sample** is a pair of source and summary.
* A **document** is either a source or a summary.
* A **chunk** is a sentence in a document.

### Tables 

Three tables: `chunks`, `embeddings`, and `annotations`. All powered by SQLite. In particular, `embeddings` is powered by `sqlite-vec`. 

#### `chunks` table: chunks and metadata

Each row is a chunk. 

A JSONL file like this:

```
# test.jsonl
{"source": "The quick brown fox. Jumps over a lazy dog. ", "summary": "26 letters."}
{"source": "We the people. Of the U.S.A. ", "summary": "The U.S. Constitution. It is great. "}
```

will be ingested into the `chunks` table as below:

| chunk_id | text                       | text_type | sample_id | char_offset | chunk_offset|
|----------|----------------------------|-----------|-----------|-------------|-------------|
| 1        | "The quick brown fox."     | source    | 1         | 0           | 0           |
| 2        | "Jumps over the lazy dog." | source    | 1         | 21          | 1           |
| 3        | "We the people."           | source    | 2         | 0           | 0           |
| 4        | "Of the U.S.A."            | source    | 2         | 15          | 1           |
| 5        | "26 letters."              | summary   | 1         | 0           | 0           |
| 6        | "The U.S. Constitution."   | summary   | 2         | 0           | 0           |
| 7        | "It is great."             | summary   | 2         | 23          | 1           |

Meaning of select columns: 
* `char_offset_local` is the offset of a chunk in its parent document measured by the starting character of the chunk. It allows us to find the chunk in the document. 
* `chunk_offset_local` is the index of a chunk in its parent document. It is used to find the chunk in the document.
* `text_type` is takes value from the ingestion file. `source` and `summary` for now.
* 1-indexed columns: `chunk_id` and `sample_id`. 
* 0-indexed columns: `char_offset_local` and `chunk_offset_local`.

#### `embeddings` table: the embeddings of chunks

| rowid    | embedding |
|----------|-----------|
| 1        | [0.1, 0.2, ..., 0.9] |
| 2        | [0.2, 0.3, ..., 0.8] |

* `id` here and `chunk_id` in the `chunks` table have one-to-one correspondence.

#### `annotations` table: the human annotations

| annot_id | sample _id | annot_spans                              |  annotator | label      |
|----------|------------|-----------------------------------------|-----------|------------|
| 1        | 1          | {'source': (1, 10), 'summary': (7, 10)} | Alice     | ["ambivalent"] |
| 2        | 1          | {'summary': (2, 8)}                     | Bob       | ["extrinsic"]  |

* `src_chunk_id` and `summ_chunk_id` are the `id`'s of chunks in the `corpus` table.
* `text_spans` is a JSON text field that stores the text spans selected by the annotator. Each entry is a dictionary where keys must be those in the `text_type` column in the `chunks` table (hardcoded to  `source` and `summary` now) and the values are lists of two integers: the start and end indices of the text span in the chunk. For extrinsic hallucinations (no connection to the source at all), only `summary`-key items. The reason we use JSON here is that SQLite does not support array types.

#### `config` table: the configuration

| key      | value |
|----------|-------|
| embdding_model | "openai/text-embedding-3-small" |
| embdding_dimension | 4 |

### How to do vector search

SQLite-vec uses Euclidean distance for vector search. So all embeddings much be normalized to unit length. Fortunately, OpenAI and Sentence-Bert's embeddings are already normalized.

1. Suppose the user selects a text span in chunk of global chunk ID `x`. Assume that the text span selection cannot cross sentence boundaries. 
2. Get `x`'s `doc_id` from the `chunks` table. 
3. Get `x`'s embedding from the `embeddings` table by `where rowid = {chunk_id}`. Denote it as `x_embedding`.
4. Get the `chunk_id`s of all chunks in the opposite document (source if `x` is in summary, and vice versa) by `where doc_id = {doc_id} and text_type={text_type}`. Denote such chunk IDs as `y1, y2, ..., yn`.
5. Send a query to SQLite like this: 
   ```sql 
     SELECT
        rowid,
        distance
      FROM embeddings
      WHERE embedding MATCH '{x_embedding}'
      and rowid in ({y1, y2, ..., yn}) 
      ORDER BY distance 
      LIMIT 5
    ```
    This will find the 5 most similar chunks to `x` in the opposite document. It limits vector search within the opposite document by `rowid in (y1, y2, ..., yn)`. Note that `rowid`, `embedding`, and `distance` are predefined by `sqlite-vec`.

Here is a running example (using the data [above](#chunks-table-chunks-and-metadata)): 

1. Suppose the data has been ingested. The embedder is `openai/`text-embedding-3-small` and the embedding dimension is 4.
2. Suppose the user selects `doc_id` 2 and `chunk_id` 6: "The U.S. Constitution." The `text_type` of `chunk_id` 6 is `summary` -- the opposite document is the source. 
3. Let's get the chunk IDs of the source document: 
    ```sql
    SELECT chunk_id
    FROM chunks
    WHERE doc_id = 2 and text_type = 'source'
    ```
    The return is `4, 5`. 
4. The embedding of "The U.S. Constitution" can be obtained from the `embeddings` table by `where rowid = 6`.
   ```sql
    SELECT embedding
    FROM embeddings
    WHERE rowid = 6
    ```
    The return is `[0.08553484082221985, 0.21519172191619873, 0.46908700466156006, 0.8522521257400513]`.
5. Now We search for its nearest neighbors in its corresponding source chunks of `rowid` 4 and 5. 
    ```sql
    SELECT
        rowid,
        distance
    FROM embeddings
    WHERE embedding MATCH '[0.08553484082221985, 0.21519172191619873, 0.46908700466156006, 0.8522521257400513]'
    and rowid in (4, 5) 
    ORDER BY distance
    ```
    The return is `[(4, 0.3506483733654022), (5, 1.1732779741287231)]`. The closest source chunk is "We the people" (`rowid=4`) which is the most famous three words in the U.S. Constitution. 

### Limitations
1. OpenAI's embedding endpoint can only embed up to 8192 tokens in each call. 
2. `embdding_dimension` is only useful for OpenAI models. Most other models do not support changing the embedding dimension.

### Embedding speed and/or embedding dimension
1. `multi-qa-mpnet-base-dot-v1` takes about 0.219 second on a x86 CPU to embed one sentence when batch_size is 1. The embedding dimension is 768. 
2. `BAAI/bge-small-en-v1.5` takes also about 0.202 second on a x86 CPU to embed one sentence when batch_size is 1. The embedding dimension is 384.
