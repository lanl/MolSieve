#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
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
