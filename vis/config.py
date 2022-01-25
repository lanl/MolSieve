class Config(object):
    MPIRUN_COMMAND = 'mpirun -n 4' # set this to an empty string if MPI is not installed
    LAMMPS_PATH = '/home/frosty/Apps/lammps/install/bin/lmp'
    LD_LIBRARY_PATH = '/home/frosty/Apps/lammps/install/lib'
    LAMMPS_RUN = MPIRUN_COMMAND + ' ' + LAMMPS_PATH
