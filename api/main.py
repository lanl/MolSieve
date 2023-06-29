import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .routers import calculate, data, scripts, worker

f = Path(__file__)
this_dir = f.parent

os.environ["OVITO_THREAD_COUNT"] = "1"
os.environ["DISPLAY"] = ""

app = FastAPI()


@app.get("/")
def frontend():
    return RedirectResponse(url="/index.html", status_code=303)


app.include_router(scripts.router)
app.include_router(data.router)
app.include_router(calculate.router)
app.include_router(worker.router)
logging.basicConfig(filename="molsieve.log", level=logging.INFO)

app.mount("/", StaticFiles(directory=f"{this_dir}/build"), name="static")
