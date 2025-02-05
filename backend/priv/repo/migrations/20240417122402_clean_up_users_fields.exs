defmodule GroupherServer.Repo.Migrations.CleanUpUsersFields do
  use Ecto.Migration

  def change do
    alter table(:users, prefix: "account") do
      remove :from_weixin
      remove :sponsor_member
      remove :paid_member
      remove :platinum_member
      remove :education_backgrounds
      remove :work_backgrounds
    end
  end
end
