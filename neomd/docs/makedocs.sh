#!/bin/sh
sphinx-apidoc -o ./source ../neomd -f --seperate
make html
