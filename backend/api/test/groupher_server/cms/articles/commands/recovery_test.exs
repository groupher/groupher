defmodule GroupherServer.Test.CMS.Articles.Commands.Recovery do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS

  test "create replay survives the Article entering Trash" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    attrs = mock_attrs(:post)
    command_id = Ecto.UUID.generate()

    assert {:ok, created} =
             CMS.Articles.create(community, :post, attrs, user, command_id: command_id)

    assert {:ok, _trash_item} = CMS.Articles.trash(created, user)

    assert {:ok, replayed} =
             CMS.Articles.create(community, :post, attrs, user, command_id: command_id)

    assert replayed.article_hash_id == created.article_hash_id
    assert replayed.id == created.id
  end

  test "update replay survives its Draft being published" do
    {community, public, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    attrs = %{
      title: "Updated through a command",
      expected_version: public.version
    }

    assert {:ok, draft} = CMS.Articles.update(public, attrs, user, command_id)

    assert {:ok, %{article: published}} =
             CMS.Articles.publish_draft(community, :post, draft.article_hash_id, user)

    assert {:ok, replayed} = CMS.Articles.update(public, attrs, user, command_id)
    assert replayed.id == published.id
    assert replayed.stage == :public
    assert replayed.title == "Updated through a command"
  end
end
