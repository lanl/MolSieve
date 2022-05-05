class CeleryConfig:
    accept_content = ['pickle']
    task_serializer = 'pickle'
    result_serializer = 'json'
    worker_send_task_events = True
