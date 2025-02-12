defmodule GroupherServer.Repo.Migrations.CleanUpOldGithubUsers do
  use Ecto.Migration

  def change do
    alter table(:users, prefix: "account") do
      remove :from_github
    end

    drop table(:github_users, prefix: "account")
  end
end
