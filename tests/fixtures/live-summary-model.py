"""Use the configured local RAG service's real chat model, without retrieval.

Only synthetic project records are passed on stdin. Credentials stay inside the
service. This is an isolated verification adapter, not a product API endpoint.
"""
import asyncio
import contextlib
import json
import sys

sys.path.insert(0, "/ragflow")

async def main():
    request = json.load(sys.stdin)
    with contextlib.redirect_stdout(sys.stderr):
        from common import settings
        settings.init_settings()
        from api.db.services.dialog_service import DialogService, get_models
        found, dialog = DialogService.get_by_id("1f8d4354c38711f193a109fdac79609a")
        if not found:
            raise RuntimeError("Configured test assistant unavailable")
        model = get_models(dialog)[3]
        messages = request["messages"]
        system = "\n".join(m["content"] for m in messages if m["role"] == "system")
        history = [m for m in messages if m["role"] != "system"]
        answer = await asyncio.wait_for(model.async_chat(
            system, history, {"temperature": 0, "max_tokens": 2200}
        ), timeout=75)
    print(json.dumps({"choices": [{"message": {"content": answer}}]}, ensure_ascii=False))

asyncio.run(main())
