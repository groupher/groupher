defmodule GroupherServer.Test.CMS.Assets.UsageHistoryScopeTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Articles.WorkingCopy.Snapshotter

  alias CMS.Model.{
    ArticleAssetRef,
    ArticleCoAuthor,
    CommunityAdmin,
    Author,
    ArticleBinding,
    ArticlePublic,
    ArticleWorkingCopy,
    CommunityAsset
  }

  test "historical and draft usage require article authority and a current site binding" do
    {community, post, _attrs, owner} = mock_article(:post)
    public = Repo.get_by!(ArticlePublic, article_id: post.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: post.id, scope_type: :default)

    asset =
      %CommunityAsset{}
      |> CommunityAsset.changeset(%{
        community_id: community.id,
        url: "https://example.com/history-scope.png",
        size_bytes: 10
      })
      |> Repo.insert!()

    for owner_attrs <- [%{working_copy_id: work.id}, %{snapshot_id: public.snapshot_id}] do
      %ArticleAssetRef{}
      |> ArticleAssetRef.changeset(
        Map.merge(owner_attrs, %{
          community_id: community.id,
          asset_id: asset.id,
          usage: :inline,
          block_id:
            if(Map.has_key?(owner_attrs, :working_copy_id),
              do: "draft-secret",
              else: "public-block"
            ),
          title: "asset detail",
          alt: "asset alt",
          source: "test"
        })
      )
      |> Repo.insert!()
    end

    updated_work = work |> Ecto.Changeset.change(revision: work.revision + 1) |> Repo.update!()

    assert {:ok, {:ok, historical}} =
             Repo.transaction(fn ->
               Snapshotter.freeze_in_transaction(
                 updated_work.id,
                 updated_work.revision,
                 owner,
                 Ecto.UUID.generate()
               )
             end)

    refute historical.id == public.snapshot_id

    {result, queries} =
      capture_queries(fn -> CMS.Assets.Query.usages(community, asset.id, owner) end)

    assert {:ok, usages} = result
    assert Enum.count(queries, &String.contains?(&1, "article_asset_refs")) == 1
    assert Enum.any?(usages, &(&1.working_copy_id == work.id))
    assert Enum.any?(usages, &(&1.snapshot_id == public.snapshot_id))

    assert {:ok, owner_page} =
             CMS.Assets.refs(community, asset.id, %{offset: %{page: 1, size: 1}}, owner)

    assert length(owner_page.entries) == 1

    {:ok, outsider} = db_insert(:user)

    Repo.insert!(
      CommunityAdmin.changeset(%CommunityAdmin{}, %{
        community_id: community.id,
        user_id: outsider.id,
        permissions: %{"asset.upload" => true}
      })
    )

    assert {:ok, low_page} =
             CMS.Assets.refs(community, asset.id, %{offset: %{page: 1, size: 1}}, outsider)

    assert [%{block_id: "public-block"}] = low_page.entries

    assert {:ok, low_second_page} =
             CMS.Assets.refs(community, asset.id, %{offset: %{page: 2, size: 1}}, outsider)

    assert low_second_page.entries == []

    lifecycle = Repo.get_by!(CMS.Model.CommunityLifecycle, community_id: community.id)
    lifecycle |> Ecto.Changeset.change(state: :read_only) |> Repo.update!()
    assert {:ok, readonly_usages} = CMS.Assets.Query.usages(community, asset.id, outsider)
    assert Enum.any?(readonly_usages, &(&1.snapshot_id == public.snapshot_id))
    lifecycle |> Ecto.Changeset.change(state: :active) |> Repo.update!()

    query = """
    query($community: String!, $asset: ID!, $page: Int!) {
      communityAssetRefs(community: $community, assetId: $asset, pagi: {offset: {page: $page, size: 1}}) {
        entries { blockId title alt source position meta }
      }
    }
    """

    vars = %{"community" => community.slug, "asset" => to_string(asset.id), "page" => 1}

    assert {:ok,
            %{data: %{"communityAssetRefs" => %{"entries" => [%{"blockId" => "public-block"}]}}}} =
             Absinthe.run(query, GroupherServerWeb.Schema,
               variables: vars,
               context: %{cur_user: outsider}
             )

    assert {:ok, %{data: %{"communityAssetRefs" => %{"entries" => []}}}} =
             Absinthe.run(query, GroupherServerWeb.Schema,
               variables: %{vars | "page" => 2},
               context: %{cur_user: outsider}
             )

    assert {:ok, outsider_usages} = CMS.Assets.Query.usages(community, asset.id, outsider)
    assert Enum.any?(outsider_usages, &(&1.snapshot_id == public.snapshot_id))
    refute Enum.any?(outsider_usages, &(&1.working_copy_id == work.id))
    refute Enum.any?(outsider_usages, &(&1.snapshot_id == historical.id))

    author = Repo.insert!(%Author{user_id: outsider.id})

    member =
      Repo.insert!(
        ArticleCoAuthor.changeset(%ArticleCoAuthor{}, %{
          article_id: post.id,
          author_id: author.id,
          joined_at: DateTime.utc_now(:second),
          permissions: %{"article.read_draft" => true, "article.history.read" => true}
        })
      )

    assert {:ok, member_usages} = CMS.Assets.Query.usages(community, asset.id, outsider)
    assert Enum.any?(member_usages, &(&1.working_copy_id == work.id))
    assert Enum.any?(member_usages, &(&1.snapshot_id == historical.id))

    assert {:ok,
            %{data: %{"communityAssetRefs" => %{"entries" => [%{"blockId" => "draft-secret"}]}}}} =
             Absinthe.run(query, GroupherServerWeb.Schema,
               variables: vars,
               context: %{cur_user: outsider}
             )

    Repo.delete!(member)
    Repo.insert!(%CMS.Model.GlobalPassport{user_id: outsider.id, is_root: true})
    assert {:ok, root_usages} = CMS.Assets.Query.usages(community, asset.id, outsider)
    assert Enum.any?(root_usages, &(&1.working_copy_id == work.id))
    assert Enum.any?(root_usages, &(&1.snapshot_id == historical.id))

    {:ok, other_community} = mock_community(owner)

    other_binding =
      %ArticleBinding{}
      |> ArticleBinding.changeset(%{
        article_id: post.id,
        community_id: other_community.id,
        inner_id: 91_001
      })
      |> Repo.insert!()

    other_asset =
      %CommunityAsset{}
      |> CommunityAsset.changeset(%{
        community_id: other_community.id,
        url: "https://example.com/other-site.png",
        size_bytes: 10
      })
      |> Repo.insert!()

    %ArticleAssetRef{}
    |> ArticleAssetRef.changeset(%{
      community_id: other_community.id,
      asset_id: other_asset.id,
      snapshot_id: historical.id,
      usage: :inline
    })
    |> Repo.insert!()

    assert {:ok, [_]} = CMS.Assets.Query.usages(other_community, other_asset.id, owner)
    Repo.delete!(other_binding)
    assert {:ok, []} = CMS.Assets.Query.usages(other_community, other_asset.id, owner)
    assert {:ok, source_usages} = CMS.Assets.Query.usages(community, asset.id, owner)
    assert Enum.any?(source_usages, &(&1.snapshot_id == historical.id))

    Repo.get_by!(ArticleBinding, article_id: post.id, community_id: community.id)
    |> Repo.delete!()

    assert {:ok, []} = CMS.Assets.Query.usages(community, asset.id, owner)
    assert {:error, _} = CMS.Assets.Persist.delete(community, asset.id)
  end

  defp capture_queries(fun) do
    ref = make_ref()
    handler = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler,
        event,
        fn _, _, metadata, {pid, id} ->
          send(pid, {id, metadata.query})
        end,
        {self(), ref}
      )

    try do
      result = fun.()
      {result, drain_queries(ref, [])}
    after
      :telemetry.detach(handler)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end
end
