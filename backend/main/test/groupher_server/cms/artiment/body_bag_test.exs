defmodule GroupherServer.CMS.Artiment.BodyBagTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Artiment.BodyBag
  alias GroupherServer.CMS.Model.ArticleDocument

  @json Jason.encode!([
          %{"type" => "p", "children" => [%{"text" => "Published body content"}]}
        ])

  test "casts the publisher contract and maps it to ArticleDocument fields" do
    assert {:ok, body_bag} = BodyBag.cast(valid_attrs())

    assert body_bag.plain_text == "Published body content"
    assert body_bag.body_hash == String.duplicate("a", 64)

    assert %{
             json: @json,
             markdown_toc: %{items: []},
             body_hash: body_hash,
             schema_version: 2,
             xml: nil,
             rss: nil
           } = BodyBag.to_document_attrs(body_bag)

    assert body_hash == String.duplicate("a", 64)
  end

  test "rebuilds the input contract from a persisted ArticleDocument" do
    document =
      struct(ArticleDocument, %{
        json: @json,
        markdown: "Published body content",
        markdown_toc: %{"items" => [%{"id" => "intro", "title" => "Intro", "level" => 1}]},
        html: "<p>Published body content</p>",
        plain_text: "Published body content",
        digest: "Published body content",
        body_hash: String.duplicate("a", 64),
        schema_version: 1
      })

    assert {:ok, body_bag} = BodyBag.from_document(document)
    assert body_bag.toc == [%{"id" => "intro", "title" => "Intro", "level" => 1}]
  end

  test "rejects unsupported schema, invalid hash, and invalid Plate root" do
    attrs = %{valid_attrs() | json: "{}", body_hash: "not-a-hash", schema_version: 3}

    assert {:error, changeset} = BodyBag.cast(attrs)
    assert "must contain a Plate root list" in errors_on(changeset).json
    assert "has invalid format" in errors_on(changeset).body_hash
    assert "is invalid" in errors_on(changeset).schema_version
  end

  test "allows canonical empty and non-empty short Docs bodies without weakening other threads" do
    assert {:ok, empty} = BodyBag.cast(BodyBag.empty_doc(), thread: :doc)
    assert empty.plain_text == ""
    assert empty.digest == ""
    assert {:error, _changeset} = BodyBag.cast(BodyBag.empty_doc())

    attrs = %{valid_attrs() | plain_text: "Go", digest: "Go"}

    assert {:ok, body_bag} = BodyBag.cast(attrs, thread: :doc)
    assert body_bag.plain_text == "Go"
    assert {:error, _changeset} = BodyBag.cast(attrs)

    assert {:error, changeset} =
             BodyBag.cast(%{attrs | plain_text: "  ", digest: ""}, thread: :doc)

    assert "can't be blank" in errors_on(changeset).plain_text
  end

  defp valid_attrs do
    %{
      json: @json,
      markdown: "Published body content",
      html: "<p>Published body content</p>",
      toc: [],
      plain_text: "Published body content",
      digest: "Published body content",
      body_hash: String.duplicate("a", 64),
      schema_version: BodyBag.schema_version()
    }
  end

  defp errors_on(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, opts} ->
      Regex.replace(~r"%{(\w+)}", message, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
