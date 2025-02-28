# Migrating data from old versions

Mercury, and its database structure, are rapidly iterating.
Make sure that you migrate the databases in the following order.

## Adding user log in (December 14, 2024)

This change enables credential-based login. This frees the user from the need to always use the same browser.

To migrate, use the following steps:

```bash
python3 add_login.py export --workdir {DIR_OF_SQLITE_FILES} --csv unified_users.csv 
python3 add_login.py register --csv unified_users.csv --db unified_users.sqlite
```

`{DIR_OF_SQLITE_FILES}` is the directory of SQLite corpus DB files that are created before login was implemented.
The script `add_login.py` extracts `user_id` and `user_name` from corpus DB file that contain annotations and dump them as a CSV file.
Then, the script creates a SQLite DB file, referred to as `USER_DB` which can be passed to updated Mercury.

## Adding versioning (v0.1.0, January 15, 2025)

To deal with the ever-changing database structure, we introduce versioning to Mercury. The version of the Mercury is stored in the `config` table of a corpus DB.  
The version of Mercury code is stored in a special file called `version.py`.
The first version is 0.1.0.

To migrate, use the following steps:

```bash
python3 database_version_control.py --db_path {OLD_CORPUS_DB}
```

It will happen in-place.

## Making use of sqlite-vec's metadata filtering (v0.1.1, January 23, 2025)

As metadata columns are supported in sqlite-vec v0.1.6, we simplified our code and database.
Tables `chunks` and `metadata` are merged into a single table `chunks`. Due to an existing [issue](https://github.com/asg017/sqlite-vec/issues/154), migration script actually creates a new database.

To migrate, use the following steps:

```bash
python3 merge_embedding.py --db_path {OLD_CORPUS_DB}
```

It will happen in-place.
