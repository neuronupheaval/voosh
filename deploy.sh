#!/bin/bash
rm -fr /c
cd /
mkdir c
cd c
gh auth login --with-token < /usr/local/share/tokens/GitHubPexeraOnline.txt
gh repo clone neuronupheaval/voosh
docker compose up --build -d
