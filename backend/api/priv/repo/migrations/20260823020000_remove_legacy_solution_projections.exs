defmodule GroupherServer.Repo.Migrations.RemoveLegacySolutionProjections do
  use Ecto.Migration

  def up do
    alter table(:comments, prefix: "cms") do
      remove(:is_solution)
    end

    alter table(:posts, prefix: "cms") do
      remove(:solution_digest)
    end
  end

  def down do
    alter table(:comments, prefix: "cms") do
      add(:is_solution, :boolean, default: false, null: false)
    end

    alter table(:posts, prefix: "cms") do
      add(:solution_digest, :string)
    end
  end
end
