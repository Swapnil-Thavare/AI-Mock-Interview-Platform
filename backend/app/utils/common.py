from typing import Any, List


def to_dict_list(items: List[Any]) -> List[dict]:
    return [item.model_dump() if hasattr(item, "model_dump") else dict(item) for item in items]
