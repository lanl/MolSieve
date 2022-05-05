class CeleryConfig:
    accept_content = ['pickle', 'json']
    task_serializer = 'pickle'
    result_serializer = 'json'
    worker_send_task_events = True
    task_track_started = True
