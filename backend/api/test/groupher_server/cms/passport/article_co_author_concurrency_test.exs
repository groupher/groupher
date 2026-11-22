defmodule GroupherServer.Test.CMS.Passport.ArticleCoAuthorConcurrencyTest do
  @moduledoc false
  use ExUnit.Case, async: false
  import Ecto.Query
  import GroupherServer.Support.Factory

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleCoAuthor, ArticleCoAuthorRequest, Author}

  @tag skip: System.get_env("TEST_REF_ISOLATED") != "1"
  @tag timeout: 60_000
  test "independent connections cannot create duplicate members or pending requests" do
    Sandbox.unboxed_run(Repo, fn ->
      {community, public, _, owner} = mock_article(:post)
      {:ok, subject} = db_insert(:user)
      author = Repo.insert!(%Author{user_id: subject.id})
      now = DateTime.utc_now(:second)

      member_attrs = %{
        article_id: public.id,
        author_id: author.id,
        joined_at: now,
        permissions: %{}
      }

      request_attrs = %{
        article_id: public.id,
        subject_user_id: subject.id,
        created_by_id: owner.id,
        type: :invite,
        proposed_permissions: %{},
        expires_at: DateTime.add(now, 604_800, :second)
      }

      try do
        member_results =
          race(fn ->
            Repo.insert(ArticleCoAuthor.changeset(%ArticleCoAuthor{}, member_attrs),
              mode: :savepoint
            )
          end)

        assert Enum.count(member_results, &match?({:ok, _}, &1)) == 1
        assert Enum.count(member_results, &match?({:error, _}, &1)) == 1

        request_results =
          race(fn ->
            Repo.insert(
              ArticleCoAuthorRequest.changeset(%ArticleCoAuthorRequest{}, request_attrs),
              mode: :savepoint
            )
          end)

        assert Enum.count(request_results, &match?({:ok, _}, &1)) == 1
        assert Enum.count(request_results, &match?({:error, _}, &1)) == 1
      after
        Repo.delete_all(
          from(r in ArticleCoAuthorRequest, where: r.article_id == ^public.id)
        )

        Repo.delete_all(from(m in ArticleCoAuthor, where: m.article_id == ^public.id))
        CMS.Seeds.FullCommunity.delete(community.slug)
      end
    end)
  end

  @tag skip: System.get_env("TEST_REF_ISOLATED") != "1"
  @tag timeout: 60_000
  test "an owner change and co-author insertion cannot create duplicate owner membership" do
    Sandbox.unboxed_run(Repo, fn ->
      {community, public, _, _owner} = mock_article(:post)
      {:ok, subject} = db_insert(:user)
      author = Repo.insert!(%Author{user_id: subject.id})
      article = Repo.get!(Article, public.id)

      attrs = %{
        article_id: article.id,
        author_id: author.id,
        joined_at: DateTime.utc_now(:second),
        permissions: %{}
      }

      parent = self()

      try do
        holder =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                Repo.update_all(from(a in Article, where: a.id == ^article.id),
                  set: [author_id: author.id]
                )

                send(parent, {:owner_locked, self()})

                receive do
                  :release -> :changed
                after
                  10_000 -> Repo.rollback(:timeout)
                end
              end)
            end)
          end)

        assert_receive {:owner_locked, holder_pid}, 10_000

        writer =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.insert(ArticleCoAuthor.changeset(%ArticleCoAuthor{}, attrs))
            end)
          end)

        assert Task.yield(writer, 100) == nil
        send(holder_pid, :release)
        assert {:ok, :changed} = Task.await(holder, 10_000)
        assert {:error, changeset} = Task.await(writer, 10_000)
        assert Keyword.has_key?(changeset.errors, :author_id)

        refute Repo.exists?(
                 from(m in ArticleCoAuthor,
                   where: m.article_id == ^article.id and m.author_id == ^author.id
                 )
               )
      after
        Repo.delete_all(from(m in ArticleCoAuthor, where: m.article_id == ^article.id))

        Repo.update_all(from(a in Article, where: a.id == ^article.id),
          set: [author_id: article.author_id]
        )

        CMS.Seeds.FullCommunity.delete(community.slug)
      end
    end)
  end

  defp race(insert) do
    parent = self()

    tasks =
      for _ <- 1..2 do
        Task.async(fn ->
          Sandbox.unboxed_run(Repo, fn ->
            send(parent, {:ready, self()})

            receive do
              :go ->
                case Repo.transaction(fn -> insert.() end) do
                  {:ok, result} -> result
                  {:error, reason} -> {:error, reason}
                end
            after
              10_000 -> {:error, :timeout}
            end
          end)
        end)
      end

    pids =
      for _ <- tasks do
        receive do
          {:ready, pid} -> pid
        after
          10_000 -> raise "connection did not become ready"
        end
      end

    Enum.each(pids, &send(&1, :go))
    Enum.map(tasks, &Task.await(&1, 10_000))
  end
end
