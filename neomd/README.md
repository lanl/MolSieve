# neomd

A scientific wrapper for neo4j, designed to be easy to use without any knowledge of neo4j syntax. Mostly concerned with converting a database to various formats for analysis.

## Install instructions

This module isn't available on `pip` just yet. When you clone this repository, create a virtual environment and run `pip -e .`. If you want various visualization stuff to be automatically installed, use `pip -e .[full-workflow]`.

If you install the `full-workflow` packages, make sure to run `jupyter nbextension enable --py --sys-prefix ipyparaview`.

You will also need to build LAAMPS and ParaView correctly to get the full functionality of this module.

Eventually, a git repository containing a build script for these two dependencies will be made available.

## ASE and LAMMPS

To use the LAMMPS calculator avaliable in ASE, you need to build and install LAMMPS with Python support enabled.

Once everything is installed, make sure that the line marked `configuration step` after the ASE Demo headline has the correct path to your lammps binary. [This link][http://devonwa.com/2016/09/01/installing-and-using-LAMMPS-with-ASE/] **may be particularly helpful** when installing LAMMPS. 

## Paraview integration

You need to build Paraview on your own with at least the following CMAKE variables set:

```
CMAKE_INSTALL_PREFIX: /path/to/a/folder/in/your/$HOME
PARAVIEW_BUILD_SHARED_LIBS: ON
PARAVIEW_USE_PYTHON: ON
VTK_GROUP_ENABLE_Imaging: YES
VTK_GROUP_ENABLE_Rendering: YES
VTK_GROUP_ENABLE_StandAlone: YES
VTK_GROUP_ENABLE_Views: YES
```

Once you have that built, you need to add the following paths to your `$PYTHONPATH` and `$LD_LIBRARY_PATH` (these are examples inside a .bashrc)

```
export LD_LIBRARY_PATH=/paraview_install_dir/lib:$LD_LIBRARY_PATH
export PYTHONPATH=/paraview_install_dir/lib/python[YOUR_VERSION_OF_PYTHON]/site-packages/]:$PYTHONPATH
```

I recommend checking the contents of the lib directory in your paraview install folder to determine what the name of the `python` folder is.

