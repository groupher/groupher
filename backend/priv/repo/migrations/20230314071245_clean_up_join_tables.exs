defmodule GroupherServer.Repo.Migrations.CleanUpJoinTables do
  use Ecto.Migration

  def change do
    drop_if_exists table("communities_join_drinks")
    drop_if_exists table("communities_join_guides")
    drop_if_exists table("communities_join_jobs")
    drop_if_exists table("communities_join_meetups")
    drop_if_exists table("communities_join_radars")
    drop_if_exists table("communities_join_repos")
    drop_if_exists table("communities_join_works")
  end
end
