# MolSieve 
Visual analytics system for analyzing long-duration molecular dynamics trajectories. NeoMD is a library written to help manage the trajectory data. Since the dependencies are difficult to manage, the `docker` image is the recommended way to use this web-server.

This program was published as a paper for *IEEE VIS 2023*: **MolSieve: A Progressive Visual Analytics System for Molecular Dynamics Simulations**. Read it on [arXiv](https://arxiv.org/abs/2308.11724).

If you use any part of this program in your research, please cite it:
```
@article{Hnatyshyn.2023.MPV,
author={Hnatyshyn, Rostyslav and Zhao, Jieqiong and Perez, Danny and Ahrens, James and Maciejewski, Ross},
journal={IEEE Transactions on Visualization and Computer Graphics}, 
title={MolSieve: A Progressive Visual Analytics System for Molecular Dynamics Simulations}, 
year={2024},
volume={30},
number={1},
pages={727-737},
keywords={Trajectory;Analytical models;Biological system modeling;Visual analytics;Three-dimensional displays;Computational modeling;Data models;Molecular dynamics;time-series analysis;visual analytics},
doi={10.1109/TVCG.2023.3326584}}
```

# Docker Installation
NOTE: The dockerfile is currently out of date.

1. Make sure to bring in all of the submodules using `git submodule update --init --recursive`.

2. Run `docker build .`

3. Run the docker image.

# Manual Installation
Make sure to bring in all of the submodules using `git submodule update --init --recursive`.

1. Build `LAMMPS` with the following options: 
   - `MANYBODY`
   - `OPENMP`
   - `REPLICA`
   - `PYTHON`
   - `BUILD_SHARED_LIBS`
   - `BUILD_MPI`
   - `BUILD_OMP`
   - `LAMMPS_EXCEPTIONS`
   - `CMAKE_INSTALL_PREFIX` set to $LAMMPS_DIR/install

2. Add `$LAMMPS_DIR/install/lib` to your `LD_LIBRARY_PATH` variable.

3. Compile and install PETSc and SLEPC using `build-petsc-slepc.sh`.

4. Install all the Python dependencies using `poetry install --no-dev`. You can find the installation instructions [here](https://python-poetry.org/docs/). **NOTE: Poetry assumes that LAMMPS has been installed in `lammps/install`.**

5. Manually install PETSc and SLEPC by entering the virtual enviornment set up by poetry and then using pip to install the Python versions of those packages. An install script will be included in the future.

# Usage

1. Connect / tunnel to a `neo4j` instance.

2. Start a `redis` instance.

3. Start the `celery` worker(s) by running `poetry run celery -A api.background_worker.celery worker` in the root directory of this project. You can specifiy further options here - this will simply start one worker.

4. Start the `uvicorn` server by running `poetry run uvicorn api.main:app`.

5. Edit `./frontend/src/api` by changing the `URL` variable to the address where the back-end will be accessed.

6. Navigate to the frontend directory and run `npm install` to install all of the necessary dependencies for the front-end.

7. Build the front-end by running `npm run build` and start it with `http-server -p 3000 --cors` in the `build` directory. 
    - If you don't want to build the front-end, you can just run `npm start`.

8. Connect to the application in your browser at `http://localhost:3000`.

All of these steps will be automated in the future.

# O# O5018
© 2025. Triad National Security, LLC. All rights reserved. This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.

# License 
This program is Open-Source under the BSD-3 License.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
