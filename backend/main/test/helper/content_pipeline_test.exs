defmodule GroupherServer.Test.Helper.ContentPipeline do
  @moduledoc false

  use GroupherServerWeb.ConnCase, async: true

  alias Helper.ContentPipeline

  @demo_ast [
    %{"type" => "h1", "children" => [%{"text" => "Plate Editor"}], "id" => "nW7cgo_LSx"},
    %{
      "type" => "p",
      "id" => "mL7LW3CklY",
      "children" => [
        %{"text" => "- dfjief "},
        %{
          "type" => "mention",
          "value" => "李四",
          "id" => "V02eytxw6m",
          "children" => [%{"text" => ""}]
        },
        %{"text" => " djfie "},
        %{
          "type" => "mention",
          "value" => "王五",
          "id" => "mMJgMhxboC",
          "children" => [%{"text" => ""}]
        }
      ]
    },
    %{
      "type" => "p",
      "id" => "link-1",
      "children" => [
        %{"text" => "ref https://groupher.com/post/123 and https://groupher.com/doc/222"}
      ]
    },
    %{
      "type" => "callout",
      "icon" => "🎉",
      "id" => "sqRyYHuGm_",
      "children" => [%{"text" => "Callout blocks highlight important notes.dfjeifje"}]
    },
    %{
      "children" => [%{"text" => "todo item"}],
      "type" => "p",
      "id" => "Ez1rrIxqkN",
      "_id" => "Ez1rrIxqkN",
      "indent" => 1,
      "checked" => false,
      "listStyleType" => "todo"
    },
    %{
      "type" => "toggle",
      "id" => "toggle-1",
      "_id" => "toggle-1",
      "children" => [%{"text" => "Toggle blocks can hide content."}]
    },
    %{
      "type" => "p",
      "id" => "marks-1",
      "children" => [
        %{"text" => "bold", "bold" => true},
        %{"text" => " italic", "italic" => true},
        %{"text" => " strike", "strikethrough" => true}
      ]
    }
  ]

  @demo_body Jason.encode!(@demo_ast)

  describe "parse/1" do
    test "returns enriched article payload" do
      {:ok, parsed} = ContentPipeline.parse(%{body: @demo_body})

      assert parsed.json == @demo_body
      assert is_binary(parsed.markdown)
      assert is_binary(parsed.html)
      assert is_binary(parsed.xml)
      assert is_binary(parsed.rss)
      assert is_map(parsed.markdown_toc)
      assert is_binary(parsed.plain_text)
      assert is_binary(parsed.digest)
      assert parsed.schema_version == 1
      assert String.length(parsed.content_hash) == 64
    end

    test "converts current editor blocks into structured output" do
      {:ok, parsed} = ContentPipeline.parse(%{body: @demo_body})

      assert parsed.markdown =~ "# Plate Editor"
      assert parsed.markdown =~ "- [ ] todo item"
      assert parsed.html =~ ~s(<h1 id="nW7cgo_LSx">Plate Editor</h1>)
      assert parsed.html =~ ~s(<aside id="sqRyYHuGm_" class="callout">)
      assert parsed.xml =~ ~s(<document>)
      assert parsed.xml =~ ~s(<block type="toggle" id="toggle-1">)
      assert get_in(parsed.markdown_toc, [:items, Access.at(0), :text]) == "Plate Editor"
    end

    test "extracts mentions from plate ast" do
      {:ok, parsed} = ContentPipeline.parse(%{body: @demo_body})

      assert "李四" in parsed.mentions
      assert "王五" in parsed.mentions
    end

    test "deduplicates mentions while preserving first-seen order" do
      body =
        Jason.encode!([
          %{
            "type" => "p",
            "children" => [
              %{"type" => "mention", "value" => "alice", "children" => [%{"text" => ""}]},
              %{"type" => "mention", "value" => "bob", "children" => [%{"text" => ""}]},
              %{"type" => "mention", "value" => "alice", "children" => [%{"text" => ""}]}
            ]
          }
        ])

      {:ok, parsed} = ContentPipeline.parse(%{body: body})

      assert parsed.mentions == ["alice", "bob"]
    end

    test "hash is stable for same input" do
      {:ok, parsed1} = ContentPipeline.parse(%{body: @demo_body})
      {:ok, parsed2} = ContentPipeline.parse(%{body: @demo_body})

      assert parsed1.content_hash == parsed2.content_hash
    end
  end
end
