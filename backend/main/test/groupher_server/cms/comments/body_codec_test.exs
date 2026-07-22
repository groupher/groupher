defmodule GroupherServer.Test.CMS.Comments.BodyCodec do
  @moduledoc false

  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Comments.BodyCodec

  test "derives only the fields persisted by Comments" do
    body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "comment-body",
          "children" => [
            %{"text" => "Hello <script>", "bold" => true},
            %{"type" => "mention", "value" => "alice", "children" => [%{"text" => ""}]}
          ]
        }
      ])

    assert {:ok, payload} = BodyCodec.parse(body)
    assert payload.json == body
    assert payload.digest == "Hello <script>alice"
    assert payload.html =~ ~s(id="comment-body")
    assert payload.html =~ "<strong>Hello &lt;script&gt;</strong>"
    assert payload.html =~ ~s(data-mention="alice")
    refute Map.has_key?(payload, :markdown)
    refute Map.has_key?(payload, :xml)
    refute Map.has_key?(payload, :rss)
  end
end
