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

# O# O5018
© 2025. Triad National Security, LLC. All rights reserved. This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.

# License 
This program is Open-Source under the BSD-3 License.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
