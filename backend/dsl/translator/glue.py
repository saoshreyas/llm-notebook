"""Glue low-level steps into a full .ndsl pipeline (agent track)."""
from __future__ import annotations

from dsl.prompt_loader import DSL_CHEAT_SHEET, render_template


def build_glue_messages(
    goal: str,
    parts: str,
    history_block: str = "(no prior cells)",
) -> list[dict]:
    system = render_template("glue_system.j2")
    user = render_template(
        "glue_user.j2",
        dsl_cheat_sheet=DSL_CHEAT_SHEET,
        goal=goal.strip(),
        parts=parts.strip(),
        history_block=history_block,
    ).strip()
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
