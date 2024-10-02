from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

@app.get("/")
async def viewer():
    return FileResponse("dist/viewer.html")

app.mount("/_next", StaticFiles(directory="dist/_next", html=True), name="dist._next")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8010)
