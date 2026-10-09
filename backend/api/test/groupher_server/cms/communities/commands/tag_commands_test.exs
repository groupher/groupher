defmodule GroupherServer.Test.CMS.Communities.Commands.TagCommandsTest do
  @moduledoc false
  use GroupherServer.TestMate

  alias GroupherServer.CMS.Communities.Tags.Commands.{
    CreateTag,
    CreateTagGroup,
    DeleteTag,
    SetTag,
    UpdateTag
  }

  setup do
    {community, post, _post_attrs, user} = mock_article(:post)
    {:ok, ~m(community post user)a}
  end

  test "tag commands use Gate and recover create/delete through one receipt",
       ~m(community user)a do
    group_command_id = Ecto.UUID.generate()

    assert {:ok, group} =
             CreateTagGroup.execute(
               community,
               :post,
               %{title: "command-group"},
               user,
               group_command_id
             )

    tag_command_id = Ecto.UUID.generate()

    attrs =
      mock_attrs(:community_tag)
      |> Map.merge(%{group_id: group.id, title: "Command Tag", slug: "command-tag"})

    assert {:ok, tag} = CreateTag.execute(community, :post, attrs, user, tag_command_id)
    assert {:ok, replayed} = CreateTag.execute(community, :post, attrs, user, tag_command_id)
    assert replayed.id == tag.id

    update_command_id = Ecto.UUID.generate()

    assert {:ok, updated} =
             UpdateTag.execute(tag.id, %{title: "Updated Tag"}, user, update_command_id)

    assert updated.title == "Updated Tag"

    delete_command_id = Ecto.UUID.generate()
    assert {:ok, deleted} = DeleteTag.execute(tag.id, user, delete_command_id)
    assert deleted.id == tag.id
    assert {:ok, deleted_replay} = DeleteTag.execute(tag.id, user, delete_command_id)
    assert deleted_replay.id == tag.id
  end

  test "set tag is a Gate-admitted one-shot command", ~m(community post user)a do
    {:ok, group} =
      CMS.Communities.create_tag_group(
        community,
        :post,
        %{title: "set-group"},
        user,
        Ecto.UUID.generate()
      )

    attrs =
      mock_attrs(:community_tag)
      |> Map.merge(%{group_id: group.id, title: "Set Tag", slug: "set-tag"})

    {:ok, tag} =
      CMS.Communities.create_tag(community, :post, attrs, user, Ecto.UUID.generate())

    assert {:ok, _updated} = SetTag.execute(post, tag.id, user, Ecto.UUID.generate())
  end
end
