defmodule GroupherServer.Test.CMS.Passport.CommunityAdminConcurrencyTest do
  use ExUnit.Case, async: false

  import Ecto.Query
  import GroupherServer.Support.Factory

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.CommunityAdmin
  alias CMS.Passport.Store

  @tag timeout: 60_000
  test "two independent transactions using one member revision cannot both grant" do
    Sandbox.unboxed_run(Repo, fn ->
      {:ok, user} = db_insert(:user)
      {:ok, community} = mock_community(user)
      member = Repo.get_by!(CommunityAdmin, user_id: user.id, community_id: community.id)
      parent = self()

      try do
        first =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                result =
                  Store.grant_community_in_transaction(user.id, community.id, member, %{
                    "doc.queue.write" => true
                  })

                send(parent, {:first_updated, self(), result})

                receive do
                  :commit -> result
                after
                  10_000 -> Repo.rollback(:barrier_timeout)
                end
              end)
            end)
          end)

        assert_receive {:first_updated, first_pid, {:ok, _}}, 10_000

        second =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, :second_started)

              Repo.transaction(fn ->
                Store.grant_community_in_transaction(user.id, community.id, member, %{
                  "doc.queue.preview" => true
                })
              end)
            end)
          end)

        assert_receive :second_started, 10_000
        assert Task.yield(second, 100) == nil
        send(first_pid, :commit)
        assert {:ok, {:ok, _}} = Task.await(first, 15_000)
        assert {:ok, {:error, :permission_revision_conflict}} = Task.await(second, 15_000)
        assert Repo.get!(CommunityAdmin, member.id).permissions == %{"doc.queue.write" => true}
      after
        Repo.delete_all(from(m in CommunityAdmin, where: m.community_id == ^community.id))
        CMS.Seeds.FullCommunity.delete(community.slug)
      end
    end)
  end
end
