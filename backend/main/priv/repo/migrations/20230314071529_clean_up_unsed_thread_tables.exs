defmodule GroupherServer.Repo.Migrations.CleanUpUnsedThreadTables do
  use Ecto.Migration

  def change do
    drop_if_exists table("cms_repo_builders")
    drop_if_exists table("meetup_documents")
    drop_if_exists table("cms_meetups")
  end
end
