alias GroupherServer.Accounts.Model.User
alias GroupherServer.CMS.Communities.Count
alias GroupherServer.CMS.Model.{Community, CommunityAdmin}
alias GroupherServer.Repo

if Mix.env() != :dev or System.get_env("DB_NAME") != "groupher_server_dev" do
  raise "This fixture only runs against MIX_ENV=dev and DB_NAME=groupher_server_dev."
end

{:ok, _started_apps} = Application.ensure_all_started(:ecto_sql)
{:ok, _repo} = Repo.start_link()

user = Repo.get_by!(User, login: "local-passport-admin")
community = Repo.get_by!(Community, slug: "home")

result =
  Repo.transaction(fn ->
    case Repo.get_by(CommunityAdmin, user_id: user.id, community_id: community.id) do
      %CommunityAdmin{is_lord: true} = existing ->
        existing

      %CommunityAdmin{} ->
        Repo.rollback(:local_admin_membership_exists_without_lord_status)

      nil ->
        with {:ok, membership} <-
               %CommunityAdmin{}
               |> CommunityAdmin.changeset(%{
                 community_id: community.id,
                 is_lord: true,
                 permissions: %{},
                 revision: 1,
                 user_id: user.id
               })
               |> Repo.insert(),
             {:ok, _community} <- Count.update(community, user, :moderators_count, :inc) do
          membership
        else
          {:error, reason} -> Repo.rollback(reason)
        end
    end
  end)

case result do
  {:ok, %CommunityAdmin{id: id}} ->
    IO.puts("Local Passport admin ready for community=#{community.slug}; membership_id=#{id}")

  {:error, reason} ->
    raise "Could not provision local Passport admin: #{inspect(reason)}"
end
