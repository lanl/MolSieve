#!/bin/bash

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get -y upgrade
apt-get -y install --no-install-recommends cmake libc6 libopenmpi-dev python3 build-essential python3-dev python3-setuptools
apt-get clean

[ -d "build" ] && rm -rf build 

mkdir build; cd build
cmake ../cmake -D PKG_MANYBODY=ON -D PKG_OPENMP=ON -D PKG_REPLICA=ON -D PKG_PYTHON=ON \
      -D BUILD_MPI=ON -D BUILD_OMP=ON -D BUILD_SHARED_LIBS=ON -D CMAKE_INSTALL_PREFIX=/lammps/install/ \
      -D LAMMPS_EXCEPTIONS=ON -D BUILD_TOOLS=ON

make clean
make install -j 16

# Delete index files we don't need anymore:
rm -rf /var/lib/apt/lists/*
