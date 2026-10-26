defmodule GroupherServer.Repo.Migrations.RemoveV1ReviewTargetTriggers do
  use Ecto.Migration

  @cms "cms"

  def up do
    for {schema, table} <- [
          {@cms, "articles"},
          {@cms, "comments"},
          {@cms, "doc_branches"},
          {"account", "users"}
        ] do
      execute("DROP TRIGGER IF EXISTS #{table}_tombstone_review_targets ON #{schema}.#{table}")
    end

    execute("DROP FUNCTION IF EXISTS #{@cms}.tombstone_review_target()")
  end

  def down do
    raise "V1 review target triggers reference retired storage"
  end
end
