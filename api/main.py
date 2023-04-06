import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import calculate, data, worker, scripts

os.environ["OVITO_THREAD_COUNT"] = "1"
os.environ["DISPLAY"] = ""

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scripts.router)
app.include_router(data.router)
app.include_router(calculate.router)
app.include_router(worker.router)
logging.basicConfig(filename="molsieve.log", level=logging.INFO)
