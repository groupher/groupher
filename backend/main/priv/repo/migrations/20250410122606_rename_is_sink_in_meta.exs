defmodule GroupherServer.Repo.Migrations.RenameIsSinkInMeta do
  use Ecto.Migration

  @prefix "cms"
  @tables ~w(posts changelogs blogs docs)a

  def up do
    Enum.each(@tables, &rename_meta_key(&1, "is_sinked", "is_sunk"))
  end

  def down do
    Enum.each(@tables, &rename_meta_key(&1, "is_sunk", "is_sinked"))
  end

  defp rename_meta_key(table, old_key, new_key) do
    execute("""
    UPDATE #{@prefix}.#{table}
    SET meta = (meta - '#{old_key}') || jsonb_build_object('#{new_key}', meta->'#{old_key}')
    WHERE meta IS NOT NULL
      AND meta ? '#{old_key}'
    """)
  end
end
