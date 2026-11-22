defmodule GroupherServer.Test.CMS.Comments.EffectIdentityTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Comments.Effects
  alias CMS.Model.{Article, Comment, CommentBody, CommentLifecycle}
  alias CMS.Outbox.Event

  test "deleting two Comments on one Article registers both effects and preserves retry provenance" do
    article = %Article{id: Ecto.UUID.generate()}
    first = %Comment{id: 101, article_id: article.id}
    second = %Comment{id: 102, article_id: article.id}
    original_ref = Ecto.UUID.generate()

    assert {:ok, {:ok, first_event}} =
             Repo.transaction(fn -> Effects.deleted(first, article, original_ref) end)

    assert {:ok, {:ok, second_event}} =
             Repo.transaction(fn -> Effects.deleted(second, article, Ecto.UUID.generate()) end)

    refute first_event.id == second_event.id
    refute first_event.dedupe_key == second_event.dedupe_key

    assert {:ok, {:ok, replay}} =
             Repo.transaction(fn -> Effects.deleted(first, article, Ecto.UUID.generate()) end)

    assert replay.id == first_event.id
    assert replay.operation_ref == original_ref

    assert Repo.get!(Event, first_event.id).data == %{
             "article_id" => article.id,
             "comment_id" => first.id
           }
  end

  test "Comment edits use the saved body version and reject a different actor for the same version" do
    article_id = Ecto.UUID.generate()
    actor = %User{id: 17}
    comment = %Comment{id: 201, article_id: article_id, body: %CommentBody{version: 2}}
    original_ref = Ecto.UUID.generate()

    assert {:ok, {:ok, first}} =
             Repo.transaction(fn -> Effects.updated(comment, actor, 11, original_ref) end)

    assert {:ok, {:ok, replay}} =
             Repo.transaction(fn -> Effects.updated(comment, actor, 11, Ecto.UUID.generate()) end)

    assert replay.id == first.id
    assert replay.operation_ref == original_ref

    assert {:ok, {:error, {:outbox_payload_conflict, event_id}}} =
             Repo.transaction(fn ->
               Effects.updated(comment, %User{id: 18}, 11, Ecto.UUID.generate())
             end)

    assert event_id == first.id

    next = %{comment | body: %CommentBody{version: 3}}

    assert {:ok, {:ok, second}} =
             Repo.transaction(fn -> Effects.updated(next, actor, 11, Ecto.UUID.generate()) end)

    refute second.id == first.id
    assert second.data["body_version"] == 3
    assert Repo.get!(Event, first.id).data["actor_id"] == actor.id
  end

  test "the Comment event owner rejects incomplete business projections" do
    assert {:error, {:outbox_payload_field_missing, "body_version"}} =
             Effects.payload_projection("comment.updated", %{
               "article_id" => Ecto.UUID.generate(),
               "actor_id" => 17,
               "community_id" => 11
             })
  end

  test "review visibility changes reject missing or malformed operation identities before writing" do
    lifecycle = %CommentLifecycle{comment_id: 301}

    for attrs <- [%{}, %{operation_ref: nil}, %{operation_ref: "invalid"}] do
      assert {:error, %{reason: :invalid_review_block}} = CMS.ReviewBlocks.apply(lifecycle, attrs)
    end

    assert {:error, %{reason: :invalid_review_block}} =
             CMS.ReviewBlocks.end_blocks(lifecycle, "platform", [], nil, "test")
  end
end
