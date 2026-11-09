defmodule GroupherServer.Test.CMS.Articles.DocOwnerConcurrencyTest do
  use ExUnit.Case, async: false
  import Ecto.Query
  import GroupherServer.Support.Factory
  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleBinding, DocBranch, DocBranchState}

  @tag timeout: 90_000
  test "OWNER-04 independent transactions cannot commit two owners, including first-writer rollback" do
    Sandbox.unboxed_run(Repo, fn ->
      {owner, template, _, _} = mock_article(:post)
      {:ok, other} = db_insert(:community)
      author_id = Repo.get!(Article, template.article_id).author_id
      parent = self()

      try do
        for isolation <- [:read_committed, :repeatable_read],
            rollback? <- [false, true],
            {first_owner, second_owner} <- [{owner, other}, {other, owner}] do
          article_id = Ecto.UUID.generate()

          first =
            Task.async(fn ->
              unboxed_transaction(isolation, fn ->
                Repo.insert!(%Article{id: article_id, author_id: author_id, thread: :doc})
                binding!(article_id, first_owner.id)
                send(parent, {:first_ready, self(), article_id})

                receive do
                  :finish -> if rollback?, do: Repo.rollback(:expected_rollback), else: :committed
                after
                  10_000 -> Repo.rollback(:barrier_timeout)
                end
              end)
            end)

          assert_receive {:first_ready, first_pid, ^article_id}, 10_000

          second =
            Task.async(fn ->
              unboxed_transaction(isolation, fn ->
                send(parent, {:second_attempting, article_id})
                now = DateTime.utc_now(:second)

                Repo.insert_all(
                  Article,
                  [
                    %{
                      id: article_id,
                      author_id: author_id,
                      thread: :doc,
                      inserted_at: now,
                      updated_at: now
                    }
                  ],
                  on_conflict: :nothing,
                  conflict_target: [:id]
                )

                binding!(article_id, second_owner.id)
              end)
            end)

          assert_receive {:second_attempting, ^article_id}, 10_000
          assert Task.yield(second, 50) == nil
          send(first_pid, :finish)
          first_result = Task.await(first, 15_000)
          second_result = Task.await(second, 15_000)

          if rollback? do
            assert {:error, :expected_rollback} = first_result
            assert {:ok, %ArticleBinding{community_id: community_id}} = second_result
            assert community_id == second_owner.id
          else
            assert {:ok, :committed} = first_result
            assert {:error, {:constraint, code}} = second_result
            assert code in ["23505", "40001"]
          end

          assert [%ArticleBinding{}] =
                   Repo.all(from(b in ArticleBinding, where: b.article_id == ^article_id))

          Repo.delete!(Repo.get!(Article, article_id))
        end
      after
        Repo.delete_all(from(a in Article, where: a.author_id == ^author_id))
      end
    end)
  end

  @tag timeout: 60_000
  test "OWNER-05 owner deletion races with membership never commit orphaned Doc rows" do
    Sandbox.unboxed_run(Repo, fn ->
      {community, doc, _, _} = mock_article(:doc)
      article_id = doc.article_id
      parent = self()

      try do
        for isolation <- [:read_committed, :repeatable_read] do
          preview =
            Repo.insert!(
              DocBranch.changeset(%DocBranch{}, %{
                community_id: community.id,
                slug: "owner-race-#{isolation |> Atom.to_string() |> String.replace("_", "-")}",
                title: "Preview",
                type: :preview,
                status: :active
              })
            )

          first =
            Task.async(fn ->
              unboxed_transaction(isolation, fn ->
                Repo.one!(from(a in Article, where: a.id == ^article_id, lock: "FOR UPDATE"))

                result =
                  Repo.query(
                    "DELETE FROM cms.article_bindings WHERE article_id=$1",
                    [Ecto.UUID.dump!(article_id)],
                    mode: :savepoint
                  )

                send(parent, {:delete_attempted, self(), result})

                receive do
                  :finish -> Repo.rollback(:rejected_owner_delete)
                after
                  10_000 -> Repo.rollback(:barrier_timeout)
                end
              end)
            end)

          assert_receive {:delete_attempted, first_pid,
                          {:error, %Postgrex.Error{postgres: %{pg_code: "23503"}}}},
                         10_000

          second =
            Task.async(fn ->
              unboxed_transaction(isolation, fn ->
                send(parent, :membership_attempting)

                Repo.insert!(
                  DocBranchState.changeset(%DocBranchState{}, %{
                    article_id: article_id,
                    branch_id: preview.id
                  })
                )
              end)
            end)

          assert_receive :membership_attempting, 10_000
          assert Task.yield(second, 50) == nil
          send(first_pid, :finish)
          assert {:error, :rejected_owner_delete} = Task.await(first, 15_000)
          assert {:ok, %DocBranchState{branch_id: branch_id}} = Task.await(second, 15_000)
          assert branch_id == preview.id
          assert {:ok, %{id: owner_id}} = CMS.Articles.Bindings.doc_owner(article_id)
          assert owner_id == community.id
        end
      after
        Repo.delete!(Repo.get!(Article, article_id))
      end
    end)
  end

  defp unboxed_transaction(isolation, fun) do
    Sandbox.unboxed_run(Repo, fn ->
      try do
        Repo.transaction(fn ->
          level = if isolation == :repeatable_read, do: "REPEATABLE READ", else: "READ COMMITTED"
          Repo.query!("SET TRANSACTION ISOLATION LEVEL " <> level, [])
          fun.()
        end)
      rescue
        error in Postgrex.Error -> {:error, {:constraint, error.postgres.pg_code}}
        error in Ecto.ConstraintError -> {:error, {:constraint, error.type}}
      end
    end)
  end

  defp binding!(article_id, community_id) do
    %{rows: [[id]]} =
      Repo.query!(
        "INSERT INTO cms.article_bindings(article_id,community_id,inserted_at,updated_at) VALUES ($1,$2,NOW(),NOW()) RETURNING id",
        [Ecto.UUID.dump!(article_id), community_id]
      )

    Repo.get!(ArticleBinding, id)
  end
end
