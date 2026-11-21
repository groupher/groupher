defmodule GroupherServer.Test.CMS.Articles.MutationLockOrderTest do
  use ExUnit.Case, async: false

  import Ecto.Query
  import GroupherServer.Support.Factory

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.MutationLock
  alias CMS.Model.{Article, ArticleBinding, ArticleEvent, CommunityLifecycle}

  test "lock plans cannot escape their transaction" do
    Sandbox.unboxed_run(Repo, fn ->
      assert {:error, :transaction_required} = MutationLock.lock_community_plan([], [])
      assert {:error, :transaction_required} = MutationLock.lock_article_rows([])

      assert {:ok, {:ok, plan}} =
               Repo.transaction(fn -> MutationLock.lock_community_plan([], []) end)

      assert {:error, :transaction_required} = MutationLock.verify_community_plan(plan)

      assert {:ok, {:error, :invalid_lock_plan}} =
               Repo.transaction(fn -> MutationLock.verify_community_plan(plan) end)
    end)
  end

  @tag timeout: 60_000
  test "all binding communities are locked before the article advisory lock" do
    Sandbox.unboxed_run(Repo, fn ->
      {x, public, _, actor} = mock_article(:post)
      {:ok, y} = mock_community(actor)
      article = Repo.get!(Article, public.id)

      Repo.insert!(
        ArticleBinding.changeset(%ArticleBinding{}, %{article_id: article.id, community_id: y.id})
      )
      event_count = Repo.aggregate(from(e in ArticleEvent, where: e.article_id == ^article.id), :count)

      parent = self()

      try do
        holder =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                Repo.one!(
                  from(l in CommunityLifecycle,
                    where: l.community_id == ^y.id,
                    lock: "FOR UPDATE"
                  )
                )

                send(parent, {:site_locked, self()})

                receive do
                  :release -> :released
                after
                  10_000 -> Repo.rollback(:timeout)
                end
              end)
            end)
          end)

        assert_receive {:site_locked, holder_pid}, 10_000

        writer =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, :writer_started)
              MutationLock.transact_article(x, article, fn -> {:ok, :written} end)
            end)
          end)

        assert_receive :writer_started, 10_000
        assert Task.yield(writer, 100) == nil

        <<key::signed-64, _::binary>> =
          :crypto.hash(:sha256, MutationLock.key(x, :post, article.id))

        probe =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                {:ok, result} = Repo.query("SELECT pg_try_advisory_xact_lock($1)", [key])
                result.rows == [[true]]
              end)
            end)
          end)

        assert {:ok, true} = Task.await(probe, 10_000)

        send(holder_pid, :release)
        assert {:ok, :released} = Task.await(holder, 10_000)
        assert {:ok, :written} = Task.await(writer, 10_000)
        assert Repo.get(Article, article.id)
        assert Repo.aggregate(from(e in ArticleEvent, where: e.article_id == ^article.id), :count) ==
                 event_count
      after
        assert {:ok, :ok} = CMS.Seeds.FullCommunity.delete(y.slug)
        assert {:ok, :ok} = CMS.Seeds.FullCommunity.delete(x.slug)
      end
    end)
  end
end
