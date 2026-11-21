defmodule GroupherServer.Test.CMS.DocTree.Publish.SiteLockTest do
  use ExUnit.Case, async: false

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.Publish.SiteLock
  alias CMS.Model.Community

  test "same-site transactions serialize, other sites proceed, and rollback releases the lock" do
    site = %Community{id: 1_000_000_000 + System.unique_integer([:positive])}
    other = %Community{id: site.id + 1}
    parent = self()

    assert {:error, :transaction_required} =
             Sandbox.unboxed_run(Repo, fn -> SiteLock.acquire(site) end)

    first =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.transaction(fn ->
            assert {:ok, :acquired} = SiteLock.acquire(site)
            send(parent, {:locked, self()})

            receive do
              :finish -> Repo.rollback(:expected)
            after
              10_000 -> Repo.rollback(:timeout)
            end
          end)
        end)
      end)

    assert_receive {:locked, first_pid}, 10_000

    second =
      Task.async(fn ->
        Sandbox.unboxed_run(Repo, fn ->
          Repo.transaction(fn ->
            send(parent, :attempting)
            SiteLock.acquire(site)
          end)
        end)
      end)

    assert_receive :attempting, 10_000
    assert Task.yield(second, 100) == nil

    assert {:ok, {:ok, :acquired}} =
             Sandbox.unboxed_run(Repo, fn ->
               Repo.transaction(fn -> SiteLock.acquire(other) end)
             end)

    send(first_pid, :finish)
    assert {:error, :expected} = Task.await(first, 10_000)
    assert {:ok, {:ok, :acquired}} = Task.await(second, 10_000)
  end
end
