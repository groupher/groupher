defmodule GroupherServer.Test.CMS.Assets.ReplaceUseHistoryTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticleAssetRef, ArticleEvent, ArticleWorkingCopy, CommunityAsset}

  test "receipt replacement freezes assets, records one event and replays" do
    {community, post, _, actor} = mock_article(:post)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: post.id, scope_type: :default)

    assets =
      for name <- ["old", "new"] do
        %CommunityAsset{}
        |> CommunityAsset.changeset(%{
          community_id: community.id,
          url: "https://example.com/replace-#{name}.png",
          size_bytes: 10
        })
        |> Repo.insert!()
      end

    [old, new] = assets

    %ArticleAssetRef{}
    |> ArticleAssetRef.changeset(%{
      community_id: community.id,
      asset_id: old.id,
      working_copy_id: work.id,
      usage: :attachment,
      block_id: "one"
    })
    |> Repo.insert!()

    command_id = Ecto.UUID.generate()

    attrs = %{
      revision: work.revision,
      usage: :attachment,
      block_id: "one",
      from_asset_id: old.id,
      to_asset_id: new.id
    }

    assert {:ok, result} = CMS.Assets.replace_use(post, attrs, actor, command_id)
    assert {:ok, replay} = CMS.Assets.replace_use(post, attrs, actor, command_id)
    assert replay.revision == result.revision

    assert %ArticleEvent{source: :browser, actor_id: actor_id, operation_index: 0} =
             event =
             Repo.get_by!(ArticleEvent,
               operation_ref:
                 Repo.get_by!(CMS.Model.CommandReceipt, command_id: command_id).operation_ref
             )

    assert actor_id == actor.id

    assert Repo.get!(CMS.Model.ArticleSnapshot, event.after_snapshot_id).causation_command_id ==
             command_id

    refute event.operation_ref == command_id
  end

  test "two actors with the same commandId receive distinct persistent event identities" do
    command_id = Ecto.UUID.generate()

    operation_refs =
      for suffix <- ["first", "second"] do
        {community, post, _, actor} = mock_article(:post)
        work = Repo.get_by!(ArticleWorkingCopy, article_id: post.id, scope_type: :default)

        [old, new] =
          for name <- ["old", "new"] do
            %CommunityAsset{}
            |> CommunityAsset.changeset(%{
              community_id: community.id,
              url: "https://example.com/#{suffix}-#{name}.png",
              size_bytes: 10
            })
            |> Repo.insert!()
          end

        %ArticleAssetRef{}
        |> ArticleAssetRef.changeset(%{
          community_id: community.id,
          asset_id: old.id,
          working_copy_id: work.id,
          usage: :attachment,
          block_id: "one"
        })
        |> Repo.insert!()

        attrs = %{
          revision: work.revision,
          usage: :attachment,
          block_id: "one",
          from_asset_id: old.id,
          to_asset_id: new.id
        }

        assert {:ok, _} = CMS.Assets.replace_use(post, attrs, actor, command_id)
        assert {:ok, _} = CMS.Assets.replace_use(post, attrs, actor, command_id)
        event = Repo.get_by!(ArticleEvent, article_id: post.id, actor_id: actor.id, type: :edit)
        assert event.actor_id == actor.id
        event.operation_ref
      end

    assert length(Enum.uniq(operation_refs)) == 2
  end
end
