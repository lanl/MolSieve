FROM debian:buster-slim AS LAMMPS_BUILD
SHELL ["/bin/bash", "-c"]
WORKDIR /lammps
COPY ./lammps .
COPY ./build-lammps.sh .
RUN ./build-lammps.sh

FROM ubuntu:jammy
SHELL ["/bin/bash", "-c"]
WORKDIR /app
COPY ./api ./api
COPY ./neomd ./neomd
COPY ./pyproject.toml .
COPY --from=LAMMPS_BUILD /lammps ./lammps
RUN apt-get update && apt-get -y upgrade
RUN apt-get -y install --no-install-recommends openmpi-bin git python3-pip qt6-base-dev libgl1-mesa-glx wget
RUN apt-get clean
ENV PYTHONPATH=${PYTHONPATH}:${PWD} 
RUN pip3 install poetry
RUN poetry config virtualenvs.create false
RUN poetry install --no-interaction --no-ansi --no-dev
RUN wget http://security.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1l-1ubuntu1.3_amd64.deb
RUN apt-get install ./libssl1.1_1.1.1l-1ubuntu1.3_amd64.deb
EXPOSE 8000