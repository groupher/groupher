defmodule GroupherServer.Test.CMS.Articles.Commands.EditingPolicyConcurrency do
  use ExUnit.Case, async: false

  import GroupherServer.Support.Factory

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleWorkingCopy, CommunityDashboard}

  @tag timeout: 60_000
  test "policy update serializes with an overlapping save on the required Dashboard row" do
    Sandbox.unboxed_run(Repo, fn ->
      {community, public, _attrs, actor} = mock_article(:post)
      article = Repo.get!(Article, public.article_id)
      work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
      assert %CommunityDashboard{} = Repo.get_by(CommunityDashboard, community_id: community.id)
      parent = self()

      try do
        updater =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                {:ok, _} =
                  CMS.Dashboard.update(
                    community,
                    :enable,
                    %{post_published_editing: false},
                    :operations,
                    Ecto.UUID.generate()
                  )

                send(parent, {:policy_written, self()})

                receive do
                  :commit -> :committed
                after
                  10_000 -> Repo.rollback(:barrier_timeout)
                end
              end)
            end)
          end)

        assert_receive {:policy_written, updater_pid}, 10_000

        saver =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, :save_attempting)

              CMS.Articles.save_working_copy(
                article,
                community,
                work.id,
                %{title: "Blocked by update"},
                work.revision,
                actor,
                Ecto.UUID.generate()
              )
            end)
          end)

        assert_receive :save_attempting, 10_000
        assert Task.yield(saver, 100) == nil
        send(updater_pid, :commit)
        assert {:ok, :committed} = Task.await(updater, 15_000)

        assert {:error, %{reason: :published_article_editing_disabled}} =
                 Task.await(saver, 15_000)

        assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision
      after
        assert {:ok, :ok} = CMS.Seeds.FullCommunity.delete(community.slug)
      end
    end)
  end

  @tag timeout: 60_000
  test "a mirror in flight is visible to content admission from another binding" do
    Sandbox.unboxed_run(Repo, fn ->
      {community, public, _attrs, author} = mock_article(:post)
      {:ok, destination} = mock_community(author)
      article = Repo.get!(Article, public.article_id)
      work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
      parent = self()

      actor =
        Map.put(author, :cur_passport, %{
          "global" => %{"post.community.mirror" => true},
          community.slug => %{"cms" => %{"post.pin" => true}},
          destination.slug => %{"cms" => %{"post.pin" => true}}
        })

      try do
        {:ok, _} =
          CMS.Dashboard.update(
            destination,
            :enable,
            %{post_published_editing: false},
            :operations,
            Ecto.UUID.generate()
          )

        mirror =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                {:ok, _} =
                  CMS.Articles.mirror(
                    destination,
                    article.id,
                    [],
                    actor,
                    community,
                    Ecto.UUID.generate()
                  )

                send(parent, {:mirror_written, self()})

                receive do
                  :commit -> :committed
                after
                  10_000 -> Repo.rollback(:barrier_timeout)
                end
              end)
            end)
          end)

        assert_receive {:mirror_written, mirror_pid}, 10_000

        saver =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, :save_attempting)

              CMS.Articles.save_working_copy(
                article,
                community,
                work.id,
                %{title: "Blocked by mirror"},
                work.revision,
                author,
                Ecto.UUID.generate()
              )
            end)
          end)

        assert_receive :save_attempting, 10_000
        assert Task.yield(saver, 100) == nil
        send(mirror_pid, :commit)
        assert {:ok, :committed} = Task.await(mirror, 15_000)

        assert {:error, %{reason: :published_article_editing_disabled}} =
                 Task.await(saver, 15_000)

        assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision
      after
        assert {:ok, :ok} = CMS.Seeds.FullCommunity.delete(community.slug)
        assert {:ok, :ok} = CMS.Seeds.FullCommunity.delete(destination.slug)
      end
    end)
  end
end
