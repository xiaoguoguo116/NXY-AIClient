FROM ragflow-custom:v0.27.1-answer-guard-9
COPY api/db/services/clarification_service.py /ragflow/api/db/services/clarification_service.py
COPY api/db/services/dialog_service.py /ragflow/api/db/services/dialog_service.py
RUN /ragflow/.venv/bin/python -m py_compile /ragflow/api/db/services/clarification_service.py /ragflow/api/db/services/dialog_service.py
