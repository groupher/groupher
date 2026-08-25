defmodule Helper.ContentThumbnailTest do
  use ExUnit.Case, async: true

  alias Helper.ContentThumbnail

  test "compiles a bounded presentation-neutral thumbnail" do
    ast = [
      %{"type" => "h1", "children" => [%{"text" => "Getting started"}]},
      %{"type" => "p", "children" => [%{"text" => String.duplicate("a", 240)}]},
      %{
        "type" => "ul",
        "listStyleType" => "disc",
        "children" => Enum.map(1..8, &%{"children" => [%{"text" => "Item #{&1}"}]})
      },
      %{
        "type" => "image",
        "url" => "https://example.com/cover.png",
        "width" => 800,
        "height" => 400
      },
      %{
        "type" => "table",
        "children" => [%{"children" => [%{}, %{}]}, %{"children" => [%{}, %{}]}]
      },
      %{"type" => "code_block", "children" => [%{"text" => Enum.join(1..12, "\n")}]},
      %{"type" => "callout", "children" => [%{"text" => "Remember this"}]},
      %{"type" => "video"},
      %{"type" => "p", "children" => [%{"text" => "This block is outside the limit"}]}
    ]

    thumbnail = ContentThumbnail.compile(ast)

    assert thumbnail["version"] == 1
    assert length(thumbnail["blocks"]) == 8

    assert %{"type" => "heading", "level" => 1, "text" => "Getting started"} =
             hd(thumbnail["blocks"])

    assert String.length(Enum.at(thumbnail["blocks"], 1)["text"]) == 180
    assert length(Enum.at(thumbnail["blocks"], 2)["items"]) == 4
    assert Enum.at(thumbnail["blocks"], 3)["aspectRatio"] == 2.0
    assert length(Enum.at(thumbnail["blocks"], 5)["lines"]) == 6
  end

  test "invalid JSON returns the versioned empty shape" do
    assert ContentThumbnail.compile_json("not-json") == %{"version" => 1, "blocks" => []}
  end
end
