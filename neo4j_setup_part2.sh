#!/bin/sh
echo "export JAVA_HOME=$HOME/jdk-17.0.2/" >> $HOME/.bashrc

mkdir java-jre
tar -xvf java-jre.tar.gz -C java-jre --strip-components 1
echo "export JAVA_HOME=$HOME/java-jre/" >> $HOME/.bashrc
echo "Set up Java JRE."

mkdir neo4j-community
tar -xvf neo4j-community.tar.gz -C neo4j-community --strip-components 1
echo "export PATH=$HOME/neo4j-community/bin/:\$PATH" >> $HOME/.bashrc
echo "Set up Neo4j."
# TODO: add more steps to setup neo4j
# still need to install APOC and gds
# add to neo4j/conf/neo4j.conf dbms.security.procedures.allowlist=gds.*

mkdir node
tar -xvf node.tar.xz -C node --strip-components 1
echo "export PATH=$HOME/node/bin/:\$PATH" >> $HOME/.bashrc
echo "Set up Node.js."

cd $HOME
git clone https://github.com/lammps/lammps.git
module load cmake/3.19.2
module load openmpi/3.1.6
module load gcc/9.3.0
cd lammps
mkdir build
cd build

#ovito=3.6
# conda install ovito, pygpcca, fastapi neo4j-python-driver uvicorn uvloop
# module load openmpi/3.1.6
# module load gcc/9.3.0
# export MPICC=$(which mpicc)
# pip install mpi4py


cmake -DCMAKE_INSTALL_PREFIX=$HOME/lammps/install/ -DBUILD_OMP=ON -DBUILD_MPI=OFF -DCMAKE_CXX_FLAGS=-std=c++11 -DBUILD_SHARED_LIBS=ON -DPKG_MANYBODY=ON -DPKG_PYTHON=ON -DPKG_REPLICA=ON -DLAMMPS_EXCEPTIONS=ON ../cmake/
make install -j 32

echo "export PATH=$HOME/lammps/install/bin:\$PATH" >> $HOME/.bashrc
echo "export PYTHONPATH=$HOME/lammps/install/lib/python3.8/site-packages:\$PYTHONPATH" >> $HOME/.bashrc
echo "export LD_LIBRARY_PATH=$HOME/lammps/install/lib64:\$LD_LIBRARY_PATH" >> $HOME/.bashrc

echo "Finished building LAMMPS."

echo "Finally, go ahead and install the dependencies in requirements.txt."
