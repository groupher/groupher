defmodule GroupherServer.Repo.Migrations.AddTemplateKeyToDocs do
  use Ecto.Migration

  @prefix "cms"

  def up do
    alter table(:docs, prefix: @prefix) do
      add_if_not_exists(:template_key, :string)
    end

    create_if_not_exists(
      index(:docs, [:community_id, :template_key],
        prefix: @prefix,
        where: "template_key IS NOT NULL",
        name: :docs_community_template_key_index
      )
    )
  end

  def down do
    drop_if_exists(
      index(:docs, [:community_id, :template_key],
        prefix: @prefix,
        name: :docs_community_template_key_index
      )
    )

    alter table(:docs, prefix: @prefix) do
      remove_if_exists(:template_key, :string)
    end
  end
end
