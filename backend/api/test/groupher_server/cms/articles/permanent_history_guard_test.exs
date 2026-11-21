defmodule GroupherServer.Test.CMS.Articles.PermanentHistoryGuardTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleEvent,
    ArticleLifecycle,
    ArticleSnapshot,
    TrashedArticle
  }

  test "global deletion rejects another site's retained history and rolls back" do
    {community, post, _, actor} = mock_article(:post)
    {:ok, other} = mock_community(actor)

    %ArticleBinding{}
    |> ArticleBinding.changeset(%{article_id: post.id, community_id: other.id, inner_id: 90_001})
    |> Repo.insert!()

    assert {:ok, item} = CMS.Articles.trash(post, actor, community: community)

    before_snapshots =
      Repo.aggregate(from(s in ArticleSnapshot, where: s.article_id == ^post.id), :count)

    before_events =
      Repo.aggregate(from(e in ArticleEvent, where: e.article_id == ^post.id), :count)

    before_deletion_audit =
      Repo.aggregate(
        from(log in GroupherServer.Activity.Model.PostLog,
          where: log.article_id == ^post.id and log.action == :permanently_deleted
        ),
        :count
      )

    assert {:error, %{reason: :article_history_protected}} =
             CMS.Articles.permanently_delete_trashed(item.hash_id, actor, community: community)

    assert Repo.get!(Article, post.id)
    assert Repo.get_by!(TrashedArticle, article_id: post.id)
    assert Repo.get_by!(ArticleLifecycle, article_id: post.id).state == :deleted
    assert Repo.get_by!(ArticleBinding, article_id: post.id, community_id: other.id)

    assert Repo.aggregate(from(s in ArticleSnapshot, where: s.article_id == ^post.id), :count) ==
             before_snapshots

    assert Repo.aggregate(from(e in ArticleEvent, where: e.article_id == ^post.id), :count) ==
             before_events

    assert Repo.aggregate(
             from(log in GroupherServer.Activity.Model.PostLog,
               where: log.article_id == ^post.id and log.action == :permanently_deleted
             ),
             :count
           ) == before_deletion_audit

    Repo.get_by!(ArticleBinding, article_id: post.id, community_id: other.id) |> Repo.delete!()

    assert Repo.get_by!(CMS.Model.ArticleHistoryOwner,
             article_id: post.id,
             community_id: other.id
           )

    assert {:error, %{reason: :article_history_protected}} =
             CMS.Articles.permanently_delete_trashed(item.hash_id, actor, community: community)

    assert Repo.get_by!(TrashedArticle, article_id: post.id)
  end

  test "version cleanup removes only the target aggregate and rolls back on later failure" do
    {community, post, _, actor} = mock_article(:post)
    {_, other, _, _} = mock_article(:post, community, actor)
    article = Repo.get!(Article, post.id)

    snapshots =
      Repo.all(from(s in ArticleSnapshot, where: s.article_id == ^post.id, select: s.id))

    assert snapshots != []

    asset =
      %CMS.Model.CommunityAsset{}
      |> CMS.Model.CommunityAsset.changeset(%{
        community_id: community.id,
        url: "https://example.com/purge-shared.png",
        size_bytes: 10
      })
      |> Repo.insert!()

    ref =
      %CMS.Model.ArticleAssetRef{}
      |> CMS.Model.ArticleAssetRef.changeset(%{
        community_id: community.id,
        asset_id: asset.id,
        snapshot_id: hd(snapshots),
        usage: :inline
      })
      |> Repo.insert!()

    other_count =
      Repo.aggregate(from(s in ArticleSnapshot, where: s.article_id == ^other.id), :count)

    assert {:error, :injected_failure} =
             Repo.transaction(fn ->
               lifecycle = Repo.get_by!(ArticleLifecycle, article_id: post.id)
               lifecycle |> Ecto.Changeset.change(state: :destroy) |> Repo.update!()

               Repo.delete_all(
                 from(p in CMS.Model.ArticlePublic, where: p.article_id == ^post.id)
               )

               assert {:ok, :purged} =
                        CMS.Articles.PermanentVersions.purge_in_transaction(article, community.id)

               refute Repo.exists?(from(s in ArticleSnapshot, where: s.id in ^snapshots))
               refute Repo.get(CMS.Model.ArticleAssetRef, ref.id)
               assert Repo.get!(CMS.Model.CommunityAsset, asset.id)

               assert Repo.aggregate(
                        from(s in ArticleSnapshot, where: s.article_id == ^other.id),
                        :count
                      ) == other_count

               Repo.rollback(:injected_failure)
             end)

    assert Repo.aggregate(from(s in ArticleSnapshot, where: s.id in ^snapshots), :count) ==
             length(snapshots)

    assert Repo.get!(CMS.Model.ArticlePublic, post.id)
    assert Repo.get!(CMS.Model.ArticleAssetRef, ref.id)
    assert Repo.get!(CMS.Model.CommunityAsset, asset.id)
  end

  test "GraphQL rejects a caller without the global trash permission" do
    {community, post, _, owner} = mock_article(:post)
    {:ok, stranger} = db_insert(:user)
    {:ok, other} = mock_community(owner)

    %ArticleBinding{}
    |> ArticleBinding.changeset(%{article_id: post.id, community_id: other.id, inner_id: 90_002})
    |> Repo.insert!()

    assert {:ok, item} = CMS.Articles.trash(post, owner, community: community)

    query = """
    mutation($command: ID!, $id: ID!, $community: String!) {
      permanentlyDeleteTrashedArticle(commandId: $command, id: $id, community: $community, thread: POST) { done }
    }
    """

    vars = %{
      "command" => Ecto.UUID.generate(),
      "id" => item.hash_id,
      "community" => community.slug
    }

    assert {:ok, %{errors: [%{extensions: %{code: 4616}} | _]}} =
             Absinthe.run(query, GroupherServerWeb.Schema,
               variables: vars,
               context: %{cur_user: stranger}
             )

    assert Repo.get_by!(TrashedArticle, article_id: post.id)
  end
end
