#!/bin/sh

echo "This script should be run on your local machine."

read -p "Please enter your LANL username." USER

if ! command -v wget &> /dev/null
then
    echo "wget not found. Please install wget."
    exit
fi

if ! command -v scp &> /dev/null
then
    echo "scp not found. Please install scp."
    exit
fi

#TODO: add running npm install and then sending it through the scp

wget https://s3-eu-west-1.amazonaws.com/com.neo4j.graphalgorithms.dist/graph-data-science/neo4j-graph-data-science-1.8.6-standalone.zip

wget --output-document java-jre.tar.gz https://download.java.net/java/GA/jdk17.0.2/dfd4a8d0985749f896bed50d7138ee7f/8/GPL/openjdk-17.0.2_linux-x64_bin.tar.gz

wget --output-document node.tar.xz https://nodejs.org/dist/v16.14.2/node-v16.14.2-linux-x64.tar.xz

wget --output-document apoc-4.3.0.5-core.jar https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/4.3.0.5/apoc-4.3.0.5-all.jar

wget --output-document neo4j-community.tar.gz https://neo4j.com/artifact.php?name=neo4j-community-4.3.10-unix.tar.gz

scp ./neo4j-graph-data-science-1.8.6-standalone.zip ./apoc-4.3.0.5-core.jar ./java-jre.tar.gz ./node.tar.xz ./neo4j-community.tar.gz $USER@wtrw.lanl.gov:gr-fe.lanl.gov:/turquoise/users/$USER

