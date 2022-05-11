FROM debian:buster-slim AS LAMMPS_BUILD
SHELL ["/bin/bash", "-c"]
WORKDIR /lammps
COPY ./lammps .
COPY ./build-lammps.sh .
RUN ./build-lammps.sh

FROM python:3.9.12-slim-buster
SHELL ["/bin/bash", "-c"]
WORKDIR /app
COPY ./api ./api
COPY ./neomd ./neomd
COPY ./pyproject.toml .
COPY --from=LAMMPS_BUILD /lammps ./lammps
RUN apt-get update && apt-get -y upgrade
RUN apt-get -y install --no-install-recommends openmpi-bin
RUN apt-get clean
ENV PYTHONPATH=${PYTHONPATH}:${PWD} 
RUN pip3 install poetry
RUN poetry config virtualenvs.create false
RUN poetry install --no-interaction --no-ansi --no-dev