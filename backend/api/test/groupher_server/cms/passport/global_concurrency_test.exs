defmodule GroupherServer.Test.CMS.Passport.GlobalConcurrencyTest do
  use ExUnit.Case, async: false
  import Ecto.Query
  import GroupherServer.Support.Factory

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.GlobalPassport
  alias CMS.Passport.Store

  @tag timeout: 60_000
  test "first grant and existing revision races are serialized per user" do
    Sandbox.unboxed_run(Repo, fn ->
      {:ok, user} = db_insert(:user)
      {:ok, other} = db_insert(:user)
      parent = self()

      try do
        first =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                result =
                  Store.grant_global_in_transaction(user.id, nil, %{"community.create" => true})

                send(parent, {:first_written, self(), result})

                receive do
                  :commit -> result
                after
                  10_000 -> Repo.rollback(:timeout)
                end
              end)
            end)
          end)

        assert_receive {:first_written, first_pid, {:ok, _}}, 10_000

        second =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, :second_started)

              Repo.transaction(fn ->
                Store.grant_global_in_transaction(user.id, nil, %{
                  "community.request_destroy" => true
                })
              end)
            end)
          end)

        assert_receive :second_started, 10_000
        assert Task.yield(second, 100) == nil

        independent =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                Store.grant_global_in_transaction(other.id, nil, %{"community.create" => true})
              end)
            end)
          end)

        assert {:ok, {:ok, _}} = Task.await(independent, 10_000)
        send(first_pid, :commit)
        assert {:ok, {:ok, current}} = Task.await(first, 10_000)
        assert {:ok, {:error, :permission_revision_conflict}} = Task.await(second, 10_000)

        third =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                result =
                  Store.grant_global_in_transaction(user.id, current, %{
                    "community.update" => true
                  })

                send(parent, {:third_written, self(), result})

                receive do
                  :commit -> result
                after
                  10_000 -> Repo.rollback(:timeout)
                end
              end)
            end)
          end)

        assert_receive {:third_written, third_pid, {:ok, _}}, 10_000

        fourth =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, :fourth_started)

              Repo.transaction(fn ->
                Store.grant_global_in_transaction(user.id, current, %{
                  "community.request_destroy" => true
                })
              end)
            end)
          end)

        assert_receive :fourth_started, 10_000
        assert Task.yield(fourth, 100) == nil
        send(third_pid, :commit)
        assert {:ok, {:ok, _}} = Task.await(third, 10_000)
        assert {:ok, {:error, :permission_revision_conflict}} = Task.await(fourth, 10_000)
      after
        Repo.delete_all(from(p in GlobalPassport, where: p.user_id in ^[user.id, other.id]))
        # Account physical deletion is prohibited; the isolated test database owns these users.
      end
    end)
  end
end
