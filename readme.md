# NeoMDWeb
Web-server for [NeoMD](https://github.com/rostyhn/neomd). Since the dependencies are difficult to manage, the `docker` image is the recommended way to use this web-server.

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

3. Install all the Python dependencies using `poetry install --no-dev` - it keeps everything as clean as possible. You can find the installation instructions [here](https://python-poetry.org/docs/). **NOTE: Poetry assumes that LAMMPS has been installed in `lammps/install`.**

4. Compile and install PETSc and SLEPC using `build-petsc-slepc.sh`.

# Usage

1. Connect / tunnel to a `Neo4j` instance.

2. Start a `redis` instance.

3. Start the `celery` worker(s) by running `poetry run celery -A api.background_worker.celery worker` in the root directory of this project. You can specifiy further options here - this will simply start one worker.

4. Start the `uvicorn` server by running `poetry run uvicorn api.main:app`.

5. Edit `./frontend/src/api` by changing the `URL` variable to the address where the back-end will be accessed.

6. Build the front-end by running `npm run build`.

7. Start the front-end by running `http-server -p 3000 --cors` in the `build` directory.

8. Connect to the application in your browser at `http://localhost:3000`.
