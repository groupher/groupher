defmodule GroupherServer.Test.CMS.AssetsTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Hash
  alias GroupherServer.CMS.Model.{ArticleDocumentAssetRef, CommunityAsset}

  describe "[cms assets]" do
    setup do
      {community, post, _attrs, user} = mock_article(:post)

      {:ok, ~m(community post user)a}
    end

    test "registers community assets and counts active storage once", ~m(community user)a do
      attrs = image_asset_attrs("hero.png", 120)

      {:ok, asset} = CMS.Assets.register(community, attrs, user)

      assert asset.asset_type == :image
      assert asset.uploader_id == user.id
      assert asset.url_hash == Hash.asset_url_hash(attrs.url)

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 1
      assert usage.storage_bytes == 120

      {:ok, same_asset} =
        CMS.Assets.register(
          community,
          Map.merge(attrs, %{size_bytes: 256, title: "updated"}),
          user
        )

      assert same_asset.id == asset.id
      assert same_asset.size_bytes == 256

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 1
      assert usage.storage_bytes == 256
    end

    test "deduplicates concurrent registrations by url hash", ~m(community user)a do
      attrs = image_asset_attrs("race.png", 128)
      parent = self()

      tasks =
        for _ <- 1..2 do
          Task.async(fn ->
            send(parent, {:task_ready, self()})

            receive do
              :go -> CMS.Assets.register(community, attrs, user)
            end
          end)
        end

      ready_pids =
        for _ <- tasks do
          assert_receive {:task_ready, pid}
          pid
        end

      Enum.each(ready_pids, &send(&1, :go))

      assets =
        Enum.map(tasks, fn task ->
          {:ok, asset} = Task.await(task, 5_000)
          asset
        end)

      assert assets |> Enum.map(& &1.id) |> Enum.uniq() |> length() == 1

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 1
      assert usage.storage_bytes == 128
    end

    test "deduplicates registered storage objects when url changes", ~m(community user)a do
      attrs =
        "signed-a.png"
        |> image_asset_attrs(64)
        |> Map.merge(%{storage: "s3", storage_key: "community/assets/signed.png"})

      {:ok, asset} = CMS.Assets.register(community, attrs, user)

      {:ok, same_asset} =
        CMS.Assets.register(
          community,
          Map.merge(attrs, %{url: "https://assets.groupher.test/signed-b.png", size_bytes: 96}),
          user
        )

      assert same_asset.id == asset.id
      assert same_asset.url == "https://assets.groupher.test/signed-b.png"
      assert same_asset.size_bytes == 96

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 1
      assert usage.storage_bytes == 96
    end

    test "syncs article document refs without changing storage ownership",
         ~m(community post user)a do
      body_asset = image_asset_attrs("body.png", 100)
      cover_asset = image_asset_attrs("cover.png", 200)

      assert {:ok, %{body: [_], cover: [_]}} =
               CMS.Assets.sync_article_refs(community, post, %{
                 cur_user: user,
                 asset_refs: [
                   %{
                     asset: body_asset,
                     block_id: "block-image-1",
                     block_type: "image",
                     alt: "body image"
                   }
                 ],
                 cover_asset: cover_asset
               })

      refs = article_refs(:post, post.id)
      assert refs |> Enum.map(& &1.usage) |> Enum.sort() == [:cover, :inline]
      assert Enum.find(refs, &(&1.usage == :inline)).block_id == "block-image-1"

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 2
      assert usage.storage_bytes == 300

      assert {:ok, %{body: [], cover: []}} =
               CMS.Assets.sync_article_refs(community, post, %{
                 asset_refs: [],
                 cover_edit_info: nil
               })

      assert article_refs(:post, post.id) == []

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 2
      assert usage.storage_bytes == 300
    end

    test "rejects refs with both asset_id and inline asset", ~m(community post user)a do
      {:ok, asset} = CMS.Assets.register(community, image_asset_attrs("existing.png", 50), user)

      assert {:error, {:custom, "asset_id and asset are mutually exclusive"}} =
               CMS.Assets.sync_article_refs(community, post, %{
                 cur_user: user,
                 asset_refs: [
                   %{
                     asset_id: asset.id,
                     asset: image_asset_attrs("ignored.png", 60)
                   }
                 ]
               })

      assert article_refs(:post, post.id) == []
    end

    test "serializes concurrent ref syncs for the same document", ~m(community post user)a do
      parent = self()

      tasks =
        ["sync-a.png", "sync-b.png"]
        |> Enum.with_index()
        |> Enum.map(fn {filename, index} ->
          Task.async(fn ->
            send(parent, {:task_ready, self()})

            receive do
              :go ->
                CMS.Assets.sync_article_refs(community, post, %{
                  cur_user: user,
                  asset_refs: [
                    %{
                      asset: image_asset_attrs(filename, 20 + index),
                      source: filename
                    }
                  ]
                })
            end
          end)
        end)

      ready_pids =
        for _ <- tasks do
          assert_receive {:task_ready, pid}
          pid
        end

      Enum.each(ready_pids, &send(&1, :go))

      Enum.each(tasks, fn task ->
        assert {:ok, %{body: [_], cover: []}} = Task.await(task, 5_000)
      end)

      refs = article_refs(:post, post.id)

      assert length(refs) == 1
      assert hd(refs).source in ["sync-a.png", "sync-b.png"]
    end

    test "paginates refs for one asset", ~m(community post user)a do
      {:ok, asset} = CMS.Assets.register(community, image_asset_attrs("many-refs.png", 70), user)

      asset_refs =
        Enum.map(1..105, fn position ->
          %{asset_id: asset.id, position: position}
        end)

      assert {:ok, %{body: refs, cover: []}} =
               CMS.Assets.sync_article_refs(community, post, %{
                 cur_user: user,
                 asset_refs: asset_refs
               })

      assert length(refs) == 105

      {:ok, paged_refs} = CMS.Assets.refs(community, asset.id, %{page: 1, size: 20})

      assert length(paged_refs.entries) == 20
      assert paged_refs.total_count == 105
      assert paged_refs.total_pages == 6
      assert paged_refs.page_number == 1

      {:ok, second_page_refs} = CMS.Assets.refs(community, asset.id, %{page: 2, size: 20})

      assert length(second_page_refs.entries) == 20
      assert second_page_refs.total_count == 105
      assert second_page_refs.total_pages == 6
      assert second_page_refs.page_number == 2

      first_page_ids = paged_refs.entries |> Enum.map(& &1.id) |> MapSet.new()
      second_page_ids = second_page_refs.entries |> Enum.map(& &1.id) |> MapSet.new()

      assert MapSet.disjoint?(first_page_ids, second_page_ids)
    end

    test "does not delete assets that are still referenced", ~m(community post user)a do
      asset_attrs = image_asset_attrs("referenced.png", 80)

      {:ok, %{body: [ref]}} =
        CMS.Assets.sync_article_refs(community, post, %{
          cur_user: user,
          asset_refs: [%{asset: asset_attrs, block_id: "referenced"}]
        })

      assert {:error, {:custom, "asset is still referenced"}} =
               CMS.Assets.delete(community, ref.asset_id)

      assert {:ok, %CommunityAsset{}} = ORM.find(CommunityAsset, ref.asset_id)
    end

    test "deleting an article purges document asset refs", ~m(community post user)a do
      asset_attrs = image_asset_attrs("delete-cleanup.png", 90)

      {:ok, %{body: [ref]}} =
        CMS.Assets.sync_article_refs(community, post, %{
          cur_user: user,
          asset_refs: [%{asset: asset_attrs, block_id: "delete-cleanup"}]
        })

      assert [_] = article_refs(:post, post.id)

      assert {:ok, _} = CMS.Articles.delete(post)

      assert article_refs(:post, post.id) == []
      assert {:ok, %CommunityAsset{}} = ORM.find(CommunityAsset, ref.asset_id)
    end
  end

  defp image_asset_attrs(filename, size_bytes) do
    %{
      url: "https://assets.groupher.test/#{filename}",
      filename: filename,
      mime_type: "image/png",
      size_bytes: size_bytes,
      width: 1200,
      height: 630
    }
  end

  defp article_refs(thread, article_id) do
    ArticleDocumentAssetRef
    |> where([ref], ref.thread == ^thread and ref.article_id == ^article_id)
    |> order_by([ref], asc: ref.usage)
    |> Repo.all()
  end
end
