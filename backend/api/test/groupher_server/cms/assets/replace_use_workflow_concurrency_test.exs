defmodule GroupherServer.Test.CMS.Assets.ReplaceUseWorkflowConcurrency do
  use ExUnit.Case, async: false

  import GroupherServer.Support.Factory
  import Ecto.Query

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.ErrorCat.Error
  alias CMS.Model.{Article, ArticleAssetRef, ArticleWorkingCopy, CommunityAsset}

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

  @tag timeout: 60_000
  test "workflow recovery chooses authorization after waiting for the Article lock" do
    concurrent_title = "Concurrent editor update #{Ecto.UUID.generate()}"

    on_exit(fn ->
      Sandbox.unboxed_run(Repo, fn ->
        work_ids =
          Repo.all(
            from(work in ArticleWorkingCopy,
              where: work.title == "Concurrent editor update" or work.title == ^concurrent_title,
              select: work.id
            )
          )

        article_ids =
          Repo.all(
            from(work in ArticleWorkingCopy,
              where: work.id in ^work_ids,
              select: work.article_id
            )
          )

        assets =
          Repo.all(from(asset in CommunityAsset, where: like(asset.filename, "recovery-race-%")))

        asset_ids = Enum.map(assets, & &1.id)

        Repo.delete_all(
          from(ref in ArticleAssetRef,
            where: ref.working_copy_id in ^work_ids or ref.asset_id in ^asset_ids
          )
        )

        Repo.delete_all(from(article in Article, where: article.id in ^article_ids))
        Repo.delete_all(from(asset in CommunityAsset, where: asset.id in ^asset_ids))
      end)
    end)

    Sandbox.unboxed_run(Repo, fn ->
      {community, post, _attrs, user} = mock_article(:post)
      article = Repo.get!(Article, post.id)

      {:ok, from_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("recovery-race-a.png", 10),
          user,
          Ecto.UUID.generate()
        )

      {:ok, to_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("recovery-race-b.png", 20),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, _} =
               CMS.Assets.link_refs(
                 post,
                 %{
                   asset_refs: [
                     %{usage: :attachment, asset_id: from_asset.id, block_id: "recovery-race"}
                   ]
                 },
                 community: community
               )

      work = Repo.get_by!(ArticleWorkingCopy, article_id: post.id, scope_kind: :default)
      workflow_ref = "asset-replacement:recovery-race:#{post.id}"

      params = %{
        revision: work.revision,
        usage: :attachment,
        block_id: "recovery-race",
        from_asset_id: from_asset.id,
        to_asset_id: to_asset.id
      }

      assert {:ok, %{revision: replaced_revision}} =
               CMS.Assets.replace_use_workflow(post, params, user, workflow_ref)

      parent = self()

      locker =
        Task.async(fn ->
          Sandbox.unboxed_run(Repo, fn ->
            CMS.Articles.MutationLock.transact_article(community, article, fn ->
              send(parent, {:article_locked, self()})

              receive do
                :change_working_copy ->
                  with {:ok, _saved} <-
                         CMS.Articles.save_working_copy(
                           article,
                           community,
                           work.id,
                           %{title: concurrent_title},
                           replaced_revision,
                           user,
                           Ecto.UUID.generate()
                         ),
                       {:ok, _dashboard} <-
                         CMS.Dashboard.update(
                           community,
                           :enable,
                           %{post_published_editing: false},
                           :operations,
                           Ecto.UUID.generate()
                         ) do
                    {:ok, :committed}
                  end
              after
                10_000 -> {:error, :barrier_timeout}
              end
            end)
          end)
        end)

      assert_receive {:article_locked, locker_pid}, 10_000

      retry =
        Task.async(fn ->
          Sandbox.unboxed_run(Repo, fn ->
            send(parent, :workflow_retry_started)
            CMS.Assets.replace_use_workflow(post, params, user, workflow_ref)
          end)
        end)

      assert_receive :workflow_retry_started, 10_000
      assert Task.yield(retry, 100) == nil
      send(locker_pid, :change_working_copy)
      assert {:ok, :committed} = Task.await(locker, 15_000)

      assert {:error, %Error{reason: :published_article_editing_disabled}} =
               Task.await(retry, 15_000)

      current = Repo.get!(ArticleWorkingCopy, work.id)
      assert current.revision == replaced_revision + 1

      assert [%ArticleAssetRef{asset_id: asset_id}] =
               Repo.all(from(ref in ArticleAssetRef, where: ref.working_copy_id == ^work.id))

      assert asset_id == to_asset.id
    end)
  end
end
