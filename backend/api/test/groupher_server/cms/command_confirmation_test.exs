defmodule GroupherServer.Test.CMS.CommandConfirmationTest do
  use ExUnit.Case, async: true

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.CollectFolders.MembershipConfirmation
  alias CMS.Articles.Commands.PublishArticleConfirmation
  alias CMS.Articles.Commands.RevisionConfirmation
  alias CMS.Command
  alias CMS.Comments.Commands.CommentConfirmation
  alias CMS.DocTree.Commands.TreeConfirmation
  alias CMS.Interactions.Reactions.UpvoteConfirmation, as: UpvoteConfirmation
  alias CMS.Interactions.Reactions.CollectConfirmation

  defmodule UnknownTypeConfirmation do
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :test_unknown_type_confirmation,
      data_keys: ["value"],
      field_types: %{"value" => :typo}
  end

  defmodule NMinusOneConfirmation do
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :test_n_minus_one_confirmation,
      schema_version: 2,
      supported_schema_versions: [1, 2],
      data_keys: ["value"],
      field_types: %{"value" => :string}
  end

  test "Article publishArticle confirmation round-trips strict Snapshot JSON" do
    value = %PublishArticleConfirmation{
      data: %{
        "article_id" => "article-1",
        "snapshot_id" => "snapshot-1",
        "published_by_id" => 7,
        "published_at" => "2026-10-03T00:00:00Z",
        "command_id" => "command-1"
      }
    }

    assert {:ok, encoded} = PublishArticleConfirmation.encode(value, :article_publish_article)
    assert encoded["operation"] == "article.publish_article"
    assert {:ok, ^value} = PublishArticleConfirmation.decode(encoded, :article_publish_article)

    assert {:error, _} =
             PublishArticleConfirmation.decode(
               Map.put(encoded, "extra", true),
               :article_publish_article
             )

    assert {:error, _} =
             PublishArticleConfirmation.decode(encoded, :article_create_and_publish_article)
  end

  test "Article Create and Update confirmations round-trip revision anchors" do
    common = [
      article_id: "article-1",
      revision_id: "revision-1",
      community_id: 3,
      author_id: 7,
      inner_id: 11,
      thread: :post,
      publication_version: 2,
      published_at: ~U[2026-10-03 00:00:00Z],
      command_id: "command-1"
    ]

    for operation <- [:article_create, :article_update] do
      value = struct!(RevisionConfirmation, common)
      assert {:ok, payload} = RevisionConfirmation.encode(value, operation)

      assert {:ok, ^value} =
               RevisionConfirmation.decode(Jason.decode!(Jason.encode!(payload)), operation)
    end

    value = struct!(RevisionConfirmation, common)
    assert {:ok, payload} = RevisionConfirmation.encode(value, :article_create)
    assert {:error, _} = RevisionConfirmation.decode(payload, :article_update)
  end

  test "shared write confirmations remain operation-bound" do
    contracts = [
      {CommentConfirmation, :comment_create, :comment_delete,
       %{
         "article_id" => "article-1",
         "comment_id" => "42",
         "command_id" => "command-1"
       }},
      {MembershipConfirmation, :collect_add, :collect_remove,
       %{
         "article_id" => "article-1",
         "folder_id" => "7",
         "operation" => "add",
         "total_count" => 1
       }},
      {CollectConfirmation, :reaction_collect_add, :reaction_collect_remove,
       %{
         "target_id" => "article-1",
         "target_type" => "article",
         "operation" => "add",
         "outcome" => "changed"
       }}
    ]

    for {module, operation, other_operation, data} <- contracts do
      value = struct!(module, data: data)
      assert {:ok, payload} = module.encode(value, operation)
      assert {:ok, ^value} = module.decode(payload, operation)
      assert {:error, _} = module.decode(payload, other_operation)
    end
  end

  test "operation tags round-trip through the canonical Command codec" do
    for operation <- [:article_publish, :upvote_add, :upvote_remove, :doc_tree_move_node] do
      assert {:ok, ^operation} =
               operation
               |> Command.operation_tag()
               |> Command.operation_from_tag()
    end

    assert {:error, :invalid_operation_tag} = Command.operation_from_tag("unknown.future")
  end

  test "shared Confirmation requires the declared variant and field types" do
    value = %UpvoteConfirmation{
      data: %{
        "operation" => "add",
        "outcome" => "changed",
        "target_id" => "article-1",
        "target_type" => "article"
      }
    }

    assert {:ok, encoded} = UpvoteConfirmation.encode(value, :upvote_add)

    assert {:ok, ^value} =
             encoded
             |> Jason.encode!()
             |> Jason.decode!()
             |> UpvoteConfirmation.decode(:upvote_add)

    assert {:error, _} = UpvoteConfirmation.decode(encoded, :upvote_remove)

    assert {:error, _} =
             UpvoteConfirmation.encode(
               %{value | data: Map.put(value.data, "target_id", 42)},
               :upvote_add
             )
  end

  test "shared Confirmation rejects unknown declared field types" do
    value = %UnknownTypeConfirmation{data: %{"value" => "ok"}}

    assert {:error, :invalid_confirmation} =
             UnknownTypeConfirmation.encode(value, :test_unknown_type_confirmation)
  end

  test "DocTree Confirmation validates the nested result sum type" do
    payload = %{
      "schema_version" => 1,
      "revision" => 4,
      "tree_state" => %{"has_unpublished_changes" => false},
      "node" => nil,
      "affected_nodes" => [],
      "conflict" => false
    }

    value = %TreeConfirmation{
      data: %{"result_key" => "community:article", "result_payload" => payload}
    }

    assert {:ok, encoded} = TreeConfirmation.encode(value, :doc_tree_create_page)
    assert {:ok, ^value} = TreeConfirmation.decode(encoded, :doc_tree_create_page)
    assert :doc_tree_restore_trash_item in TreeConfirmation.operations()

    assert {:error, :invalid_confirmation} =
             TreeConfirmation.encode(
               %{
                 value
                 | data: %{
                     value.data
                     | "result_payload" => Map.put(payload, "unexpected", true)
                   }
               },
               :doc_tree_create_page
             )
  end

  test "ConfirmationDefinition supports an explicit N/N-1 reader window" do
    value = %NMinusOneConfirmation{data: %{"value" => "ok"}}

    assert {:ok, encoded} = NMinusOneConfirmation.encode(value, :test_n_minus_one_confirmation)
    assert encoded["schema_version"] == 2

    assert {:ok, ^value} =
             NMinusOneConfirmation.decode(
               %{encoded | "schema_version" => 1},
               :test_n_minus_one_confirmation
             )

    assert {:error, _} =
             NMinusOneConfirmation.decode(
               %{encoded | "schema_version" => 0},
               :test_n_minus_one_confirmation
             )
  end
end
