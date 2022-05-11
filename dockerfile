FROM debian:latest AS LAMMPS_BUILD
SHELL ["/bin/bash", "-c"]
WORKDIR /lammps
COPY ./lammps .
COPY ./build-lammps.sh .
RUN ./build-lammps.sh

FROM debian:latest
SHELL ["/bin/bash", "-c"]
WORKDIR /app
COPY ./api ./api
COPY ./frontend ./frontend
COPY ./neomd ./neomd
COPY ./pyproject.toml .
COPY --from=LAMMPS_BUILD /lammps ./lammps
RUN apt-get update && apt-get -y upgrade
RUN apt-get -y install --no-install-recommends python3 python3-setuptools curl openmpi-bin nodejs npm redis-server
RUN apt-get clean
RUN curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python3 -
ENV PATH="${PATH}:/root/.poetry/bin"
RUN poetry install --no-interaction --no-ansi