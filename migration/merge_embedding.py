import argparse
import os
import sqlite3

import sqlite_vec


class Migrator:
    def __init__(self, old_db_path):
        self.old_db_path = old_db_path
        old_conn = sqlite3.connect(old_db_path)
        old_conn.enable_load_extension(True)
        sqlite_vec.load(old_conn)
        old_conn.enable_load_extension(False)
        database_version = old_conn.execute("SELECT value FROM config WHERE key = 'version'").fetchone()
        if database_version is None:
            print("Can not determine database version.")
            exit(0)
        if database_version[0] != "0.1.0":
            print("Database version is not 0.1.0")
            exit(0)
        table = old_conn.execute(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='chunks' OR name='embeddings'").fetchone()
        if table is None or table[0] != 2:
            print("No table found")
            exit(0)
        self.old_conn = old_conn
        self.old_db_cursor = old_conn.cursor()

    def migrate(self):
        new_db_conn = sqlite3.connect("./temp.sqlite")
        new_db_conn.close()
        self.old_db_cursor.execute("ATTACH DATABASE './temp.sqlite' AS temp1")
        # Copy unchanged tables
        config_exist = self.old_db_cursor.execute(
            "SELECT count(*) FROM main.sqlite_master WHERE type='table' AND name='config'").fetchone()
        if config_exist[0] == 1:
            self.old_db_cursor.execute(
                "CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY UNIQUE , value TEXT)"
            )
            self.old_db_cursor.execute("CREATE TABLE IF NOT EXISTS temp1.config AS SELECT * FROM main.config")

        annotations_exist = self.old_db_cursor.execute(
            "SELECT count(*) FROM main.sqlite_master WHERE type='table' AND name='annotations'").fetchone()
        if annotations_exist[0] == 1:
            self.old_db_cursor.execute("CREATE TABLE IF NOT EXISTS temp1.annotations (\
                annot_id INTEGER PRIMARY KEY AUTOINCREMENT, \
                sample_id INTEGER, \
                annot_spans TEXT, \
                annotator TEXT, \
                label TEXT, \
                note TEXT)")
            self.old_db_cursor.execute("CREATE TABLE IF NOT EXISTS temp1.annotations AS SELECT * FROM main.annotations")

        comments_exist = self.old_db_cursor.execute(
            "SELECT count(*) FROM main.sqlite_master WHERE type='table' AND name='comments'").fetchone()
        if comments_exist[0] == 1:
            self.old_db_cursor.execute("CREATE TABLE IF NOT EXISTS comments (\
                comment_id INTEGER PRIMARY KEY AUTOINCREMENT,\
                user_id TEXT NOT NULL,\
                annot_id INTEGER NOT NULL,\
                parent_id INTEGER,\
                text TEXT NOT NULL,\
                comment_time DATETIME DEFAULT CURRENT_TIMESTAMP,\
                FOREIGN KEY (annot_id) REFERENCES annotations (annot_id)\
                )")
            self.old_db_cursor.execute("CREATE TABLE IF NOT EXISTS temp1.comments AS SELECT * FROM main.comments")

        sample_meta_exist = self.old_db_cursor.execute(
            "SELECT count(*) FROM main.sqlite_master WHERE type='table' AND name='sample_meta'").fetchone()
        if sample_meta_exist[0] == 1:
            self.old_db_cursor.execute(
                "CREATE TABLE IF NOT EXISTS sample_meta (sample_id INTEGER PRIMARY KEY, json_meta TEXT)"
            )
            self.old_db_cursor.execute("CREATE TABLE IF NOT EXISTS temp1.sample_meta AS SELECT * FROM main.sample_meta")

        # Migrate chunks and embeddings
        dimension = \
            self.old_db_cursor.execute("SELECT value FROM main.config WHERE key = 'embedding_dimension'").fetchone()[0]
        if dimension is None:
            print("No embedding dimension found")
            return
        self.old_db_cursor.execute(
            f"CREATE VIRTUAL TABLE IF NOT EXISTS temp1.chunks USING vec0(chunk_id INTEGER PRIMARY KEY, text TEXT, text_type TEXT, sample_id INTEGER, char_offset INTEGER, chunk_offset INTEGER, embedding float[{dimension}])")

        old_embeddings = self.old_db_cursor.execute("SELECT * FROM main.embeddings").fetchall()
        for rowid, old_embedding in old_embeddings:
            metadata = self.old_db_cursor.execute(
                "SELECT chunk_id, text, text_type, sample_id, char_offset, chunk_offset FROM main.chunks WHERE chunk_id = ?",
                (rowid,)).fetchone()
            self.old_db_cursor.execute(
                "INSERT INTO temp1.chunks (chunk_id, text, text_type, sample_id, char_offset, chunk_offset, embedding) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (*metadata, old_embedding))

        self.old_db_cursor.execute("UPDATE temp1.config SET value = '0.1.1' WHERE key = 'version'")
        self.old_conn.commit()
        self.old_db_cursor.execute("DETACH DATABASE temp1")
        os.remove(self.old_db_path)
        os.rename("./temp.sqlite", self.old_db_path)
        print("Migration completed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate the database from version 0.1.0 to 0.1.1")
    parser.add_argument("--db_path", help="Path to the database", default="../mercury.sqlite")
    args = parser.parse_args()
    migrator = Migrator(args.db_path)
    migrator.migrate()
