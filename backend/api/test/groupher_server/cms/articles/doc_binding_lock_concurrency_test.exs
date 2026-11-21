defmodule GroupherServer.Test.CMS.Articles.DocBindingLockConcurrencyTest do
  @moduledoc false
  use ExUnit.Case, async: false
  import Ecto.Query
  import GroupherServer.Support.Factory

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.MutationLock
  alias CMS.Model.{Article, ArticleBinding, CommunityAdmin, CommunityLifecycle}

  @tag skip: System.get_env("TEST_REF_ISOLATED") != "1"
  @tag timeout: 60_000
  test "cross-site Doc binding changes are rechecked after the shared Article row lock" do
    Sandbox.unboxed_run(Repo, fn ->
      {x, public, _, actor} = mock_article(:post)
      {:ok, y} = mock_community(actor)
      post = Repo.get!(Article, public.id)

      {:ok, doc} =
        Repo.transaction(fn ->
          doc =
            Repo.insert!(
              Article.changeset(%Article{}, %{thread: :doc, author_id: post.author_id})
            )

          Repo.insert!(
            ArticleBinding.changeset(%ArticleBinding{}, %{article_id: doc.id, community_id: x.id})
          )

          doc
        end)

      parent = self()

      try do
        holder =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                Repo.one!(
                  from(l in CommunityLifecycle, where: l.community_id == ^y.id, lock: "FOR SHARE")
                )

                Repo.one!(from(a in Article, where: a.id == ^doc.id, lock: "FOR UPDATE"))
                send(parent, {:locked, self()})

                receive do
                  :insert ->
                    Repo.insert!(
                      ArticleBinding.changeset(%ArticleBinding{}, %{
                        article_id: doc.id,
                        community_id: y.id
                      })
                    )

                    :inserted
                after
                  10_000 -> Repo.rollback(:timeout)
                end
              end)
            end)
          end)

        assert_receive {:locked, holder_pid}, 10_000

        writer =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              MutationLock.transact_article(x, doc, fn -> {:ok, :written} end)
            end)
          end)

        <<x_key::signed-64, _::binary>> = :crypto.hash(:sha256, MutationLock.key(x, :doc, doc.id))
        <<y_key::signed-64, _::binary>> = :crypto.hash(:sha256, MutationLock.key(y, :doc, doc.id))
        assert x_key != y_key

        probe = fn key ->
          Repo.transaction(fn ->
            {:ok, result} = Repo.query("SELECT pg_try_advisory_xact_lock($1)", [key])
            result.rows == [[true]]
          end)
        end

        assert_eventually = fn ->
          Enum.reduce_while(1..100, false, fn _, _ ->
            if probe.(x_key) == {:ok, false},
              do: {:halt, true},
              else:
                (
                  Process.sleep(20)
                  {:cont, false}
                )
          end)
        end

        assert assert_eventually.()
        assert probe.(y_key) == {:ok, true}
        send(holder_pid, :insert)
        assert {:ok, :inserted} = Task.await(holder, 10_000)
        assert {:error, %{reason: :community_admission_changed}} = Task.await(writer, 10_000)
      after
        Repo.transaction(fn ->
          Repo.update_all(from(l in CommunityLifecycle, where: l.community_id in ^[x.id, y.id]),
            set: [state: :destroy]
          )

          Repo.delete_all(from(b in ArticleBinding, where: b.article_id == ^doc.id))

          Repo.delete_all(
            from(o in CMS.Model.ArticleHistoryOwner, where: o.article_id == ^doc.id)
          )

          Repo.delete!(doc)
        end)

        Repo.delete_all(from(m in CommunityAdmin, where: m.community_id in ^[x.id, y.id]))
        CMS.Seeds.FullCommunity.delete(y.slug)
        CMS.Seeds.FullCommunity.delete(x.slug)
      end
    end)
  end
end
