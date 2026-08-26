from pathlib import Path
import importlib.util

spec = importlib.util.spec_from_file_location("tools", Path(__file__).resolve().parents[1] / "src" / "tools.py")
tools = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tools)

try:
    tools.execute_tool({"name": "delete"})
    raise SystemExit("expected unauthorized tool to fail")
except PermissionError as error:
    if str(error) != "unauthorized":
        raise
