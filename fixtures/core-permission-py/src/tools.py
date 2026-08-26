def authorize(tool_call):
    return tool_call["name"] == "search"

def execute_tool(tool_call):
    if not authorize(tool_call):
        raise PermissionError("unauthorized")
    return {"ok": True}
