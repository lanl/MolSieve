#!/bin/bash

session="molsieve"

tmux new-session -d -s $session

# launch uvicorn server
tmux send-keys -t $session:0 'poetry run uvicorn api.main:app --host 0.0.0.0' C-m

# launch celery
tmux new-window -t $session:1
tmux send-keys -t $session:1 'poetry run celery -A api.background_worker.celery worker -l INFO' C-m

tmux attach-session -t $session
