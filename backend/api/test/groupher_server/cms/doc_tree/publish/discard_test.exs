defmodule GroupherServer.CMS.DocTree.Publish.DiscardTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.Queue

  defp content do
    %{
      title: "Title",
      digest: "",
      slug: nil,
      subtitle: nil,
      link_addr: nil,
      template_key: nil,
      cover_url: nil,
      cover_url_dark: nil,
      body: %{
        json: "[]",
        schema_version: 1,
        markdown: "",
        html: "",
        markdown_toc: %{},
        plain_text: "",
        thumbnail: %{},
        xml: nil,
        rss: nil
      },
      tags: [],
      cover_edit: nil,
      asset_refs: [],
      cover_refs: []
    }
  end

  defp document(id, source, queue, default, revision \\ 1) do
    %{article_id: id, default_revision: revision, source: source, queue: queue, default: default}
  end

  test "only edits exclusive to Q require confirmation" do
    base = content()
    id = Ecto.UUID.generate()
    operation = %{"kind" => "dequeue", "article_ids" => [id]}
    same = document(id, base, %{base | title: "same"}, %{base | title: "same"})

    assert {:ok, %{documents: [%{"exclusive_fields" => []}]}} =
             Queue.check_discard(operation, 3, [same])

    dirty = document(id, base, %{base | title: "Q only"}, %{base | digest: "D only"})

    assert {:error,
            {:discard_confirmation_required, %{documents: [details], confirmation: proof}}} =
             Queue.check_discard(operation, 3, [dirty])

    assert details == %{
             "article_id" => id,
             "default_revision" => 1,
             "exclusive_fields" => ["title"]
           }

    assert {:ok, _} = Queue.check_discard(operation, 3, [dirty], proof)
  end

  test "confirmation binds the complete operation, affected set and current revisions" do
    base = content()
    first_id = Ecto.UUID.generate()
    second_id = Ecto.UUID.generate()
    operation = %{"kind" => "delete_node", "node_id" => "parent"}
    first = document(first_id, base, %{base | title: "Q"}, base)
    second = document(second_id, base, base, base, 4)

    assert {:error, {:discard_confirmation_required, %{confirmation: proof}}} =
             Queue.check_discard(operation, 8, [first, second])

    assert {:ok, _} = Queue.check_discard(operation, 8, [second, first], proof)

    assert {:error, :stale_discard_confirmation} =
             Queue.check_discard(operation, 9, [first, second], proof)

    assert {:error, :stale_discard_confirmation} =
             Queue.check_discard(operation, 8, [first], proof)

    assert {:error, :stale_discard_confirmation} =
             Queue.check_discard(%{operation | "node_id" => "other"}, 8, [first, second], proof)

    assert {:error, :stale_discard_confirmation} =
             Queue.check_discard(operation, 8, [first, %{second | default_revision: 5}], proof)

    assert {:error, :stale_discard_confirmation} =
             Queue.check_discard(
               operation,
               8,
               [%{first | queue: %{base | subtitle: "changed"}}, second],
               proof
             )
  end

  test "invalid or duplicate input fails without manufacturing confirmation" do
    base = content()
    id = Ecto.UUID.generate()
    item = document(id, base, base, base)

    assert {:error, :invalid_discard_request} =
             Queue.check_discard(%{"kind" => "dequeue"}, 0, [item, item])

    assert {:error, :invalid_discard_request} =
             Queue.check_discard(%{"kind" => "dequeue"}, 0, [%{item | default_revision: 0}])

    assert {:error, :invalid_discard_request} = Queue.check_discard(%{}, 0, [item])
  end
end
