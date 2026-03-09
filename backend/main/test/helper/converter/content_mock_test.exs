defmodule GroupherServer.Test.Helper.Converter.ContentMock do
  @moduledoc false

  use GroupherServerWeb.ConnCase, async: true

  alias Helper.Converter.Content

  describe "convert/1" do
    test "returns required derived fields" do
      ast = [
        %{
          "type" => "p",
          "children" => [%{"text" => "hello "}, %{"type" => "mention", "value" => "李四"}]
        }
      ]

      {:ok, result} = Content.convert(ast)

      assert is_binary(result.markdown)
      assert is_map(result.markdown_toc)
      assert is_binary(result.html)
      assert is_binary(result.rss)
      assert is_binary(result.plain_text)
    end
  end
end
