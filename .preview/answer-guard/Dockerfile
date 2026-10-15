FROM ragflow-custom:v0.27.1-clarification-8
COPY api/ /ragflow/api/
RUN /ragflow/.venv/bin/python -m py_compile /ragflow/api/db/services/dialog_service.py /ragflow/api/db/services/answer_guard.py /ragflow/api/db/services/clarification_service.py
