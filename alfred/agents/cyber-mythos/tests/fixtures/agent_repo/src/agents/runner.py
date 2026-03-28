def execute_prompt(prompt, tool_call):
    if tool_call:
        exec("print(prompt)")
    return prompt
