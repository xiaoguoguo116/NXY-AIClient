"""Test staged modules without replacing the running service's files."""
import importlib.util
from pathlib import Path
import sys
import unittest

root = Path(__file__).resolve().parent
sys.path.insert(0, "/ragflow")
import api.db.services as services

for name in ("clarification_service", "dialog_service"):
    qualified = f"api.db.services.{name}"
    spec = importlib.util.spec_from_file_location(qualified, root / "api/db/services" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[qualified] = module
    setattr(services, name, module)
    spec.loader.exec_module(module)

suite = unittest.defaultTestLoader.discover(str(root / "tests"), pattern="test_*.py")
result = unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(0 if result.wasSuccessful() else 1)
