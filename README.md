# Mercury

> [!NOTE]
> WIP: This project is under active development

An interface for data labeling, where the user can select two pieces of text from the article and summary, respectively, to label whether they match or not.

We currently use Vectara for highlighting, where the backend can help highlight potentially relevant statements ahead of time as the user selects them, and differentiate the relevant levels by background color.

![Header](.github/header.png)

## Usage

> [!NOTE]
> You need Python and Node.js.

As mentioned before, we use Vectara, you need to set the following environment variables first:

- `VECTARA_CUSTOMER_ID`: In the vectara console, you can find it:

    ![ID](.github/id.png)

- `VECTARA_API_KEY`: You need create a personal api key ([click here](https://console.vectara.com/console/apiAccess/personalApiKey)), and copy it.
- `MERCURY_FILE`: A CSV, JSON, or JSONL file containing at least two columns namely "source" and "summary".

You can also write the above environment variables to `.env`.

Once everything is complete, you can start Mercury by following these steps:

1. `pip3 install -r requirements.txt`
2. `python3 ingester.py` for data initing (if you don't use your own corpus, you need 3 corpuses for this project)
3. `pnpm install && pnpm build` (if you don't have `pnpm` installed: `npm install -g pnpm`, you may need sudo)
4. `python3 server.py`

Do not run ingester.py unless you need to reset the database or the source/summary set; to export the database use `python3 database.py`.
