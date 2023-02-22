#!/bin/bash 
# make sure to install PETSc / SLEPc dependencies - this is system specific, so I left it out 
# also, make sure that your virtual environment is activated - specific to the user, so I left that out 
# need numpy, cython, mpi4py 
pip install numpy cython mpi4py 

# build PETSc 
[! -d "./petsc"] && git clone https://gitlab.com/petsc/petsc 
pushd petsc 
git checkout --track origin/release 
export PETSC_DIR=$PWD 
export PETSC_ARCH=arch-linux-c-opt 
python ./configure --with-cc=mpicc --with-fc=0 --with-cxx=mpicxx --with-debugging=0 --with-mpi=1 --with-shared-libraries=1 --with-mpi-f90module-visibility=0 
make all 
make check 

# this is the key to building petsc4py successfully! otherwise, it will fail 
NUMPY_INCLUDE="$(python -c 'import numpy; print(numpy.get_include())')"
ln -sfv "$NUMPY_INCLUDE/numpy" "$PETSC_DIR/$PETSC_ARCH/include" 

# build & install petsc4py in current virtual environment 
pushd src/binding/petsc4py 
python setup.py install 
popd  
popd

# build SLEPc 
[! -d "./slepc"] && git clone https://gitlab.com/slepc/slepc 
pushd slepc 
git checkout --track origin/release 
export SLEPC_DIR=$PWD 
python ./configure 
make all 
make check 

# build & install slepc4py 
pushd src/binding/slepc4py 
python setup.py install 
popd 
popd

# finally install pygpcca 
pip install pygpcca
