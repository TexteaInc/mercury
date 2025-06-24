# User administration in Mercury

Mercury uses a SQLite DB for user info (denoted as `USER_DB`) that is separate from the main corpus DB `CORPUS_DB`. By decoupling the user administration from the corpus, we can have a single user DB for multiple corpora and the annotation is always de-anonymized. 

Here are the fields in a Mercury `USER_DB`:
* `user_id`: Hash string that uniquely identifies a user
* `user_name`: User's name (for display purpose only, not for login)
* `email`: User's email (for login)
* `hashed_password`: Hashed password (for login)

### The admin script `user_admin.py`

The script for user administration is `user_admin.py`. It is located in the root directory of the Mercury repo.

The default name for the `USER_DB` is `users.sqlite`. You can override it by using the `--user_db` option. See `user_admin.py -h` for more details.

Actions that can be performed via `user_admin.py`:
* Creating a new user

  There are two ways to create a new user:

   1. Using interactive mode:
      ```bash
      python user_admin.py new
      ```
      then follow the prompts.

  2. Using command line arguments:
   
     ```bash
     python user_admin.py new -n <user_name> -e <email> -p <password>
     ```
     
     An example is shown below to create a user of `user_name` `forrest`, `email` `forrest@example.com`, and `password` `Mercury!`:

     ```
     $ python3 user_admin.py new -n forrest -e forrest@example.com -p Mercury!
     User created with user_id 162be6238bee46699cc532afa9217c72, email forrest@example.com, password Mercury!
     Please save the email and password in a secure location. You will not be able to reveal password again.
     ```

     Note that the user_name is more like a display name and is not used as part of login credentials. An annotator logs in using a combination of email and password. 

* Listing all users
 
   ```bash
   python user_admin.py list
   ```

   When listing users, the hashed password is not shown. An example is shown below:

   ```
   $ python3 user_admin.py list
   user_id                          | user_name       | email
   -------------------------------- | --------------- | --------------------
   162be6238bee46699cc532afa9217c72 | forrest         | forrest@example.com
   ```

* Changing the password or email of a user, including resetting password

  There are two ways to update a user's info:
  1. Using interactive mode:
   
     ```bash
     python user_admin.py update
     ```
     then follow the prompts.
    
  2. Using command line arguments:
     ```bash
     python user_admin.py update -k <field_to_locate_user> -v <value_to_locate_user> -f <field_to_update> -n <new_value_of_the_field>
     ```

     For example, to change the password of a user with email `test@example.com` to `abcdefg`:

     ```bash
     python user_admin.py update -k email -v test@example.com -f password -n abcdefg
     ```

For various reasons, Mercury does not support deleting users. However, you can simply change the password of a user to a random string to effectively disable the user.

Mercury has minimal exception handling for user administration. 