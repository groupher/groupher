from types import SimpleNamespace

import pytest

from conversion import _markdown_from


def test_preserves_empty_markdown_without_falling_back() -> None:
    result = SimpleNamespace(markdown="", text_content="legacy fallback")

    assert _markdown_from(result) == ""


@pytest.mark.parametrize("markdown", [None, 42])
def test_falls_back_when_markdown_is_not_a_string(markdown: object) -> None:
    result = SimpleNamespace(markdown=markdown, text_content="legacy fallback")

    assert _markdown_from(result) == "legacy fallback"


def test_rejects_result_without_string_content() -> None:
    result = SimpleNamespace(markdown=None, text_content=None)

    with pytest.raises(RuntimeError, match="returned no Markdown content"):
        _markdown_from(result)
