defmodule GroupherServer.Repo.Migrations.CreateArticleBindingTrash do
  use Ecto.Migration

  def up do
    create(
      unique_index(:article_bindings, [:id, :community_id, :article_id],
        prefix: "cms",
        name: :article_bindings_scope_identity_index
      )
    )

    create table(:article_binding_trash, prefix: "cms", primary_key: false) do
      add(:id, :uuid, primary_key: true)

      add(:community_id, references(:communities, prefix: "cms", on_delete: :restrict),
        null: false
      )

      add(:article_id, references(:articles, prefix: "cms", type: :uuid, on_delete: :restrict),
        null: false
      )

      add(:binding_id, references(:article_bindings, prefix: "cms", on_delete: :restrict),
        null: false
      )

      add(:actor_id, references(:users, prefix: "account", on_delete: :restrict), null: false)
      add(:revision, :bigint, null: false, default: 1)
      add(:hidden_at, :timestamptz, null: false)
      timestamps()
    end

    create(unique_index(:article_binding_trash, [:community_id, :article_id], prefix: "cms"))
    create(unique_index(:article_binding_trash, [:binding_id], prefix: "cms"))
    create(index(:article_binding_trash, [:community_id, :inserted_at, :id], prefix: "cms"))

    create(
      constraint(:article_binding_trash, :article_binding_trash_revision_check,
        prefix: "cms",
        check: "revision > 0"
      )
    )

    execute("""
    ALTER TABLE cms.article_binding_trash
    ADD CONSTRAINT article_binding_trash_binding_scope_fkey
    FOREIGN KEY (binding_id, community_id, article_id)
    REFERENCES cms.article_bindings (id, community_id, article_id)
    ON DELETE RESTRICT
    """)
  end

  def down do
    drop(table(:article_binding_trash, prefix: "cms"))

    drop(
      index(:article_bindings, [:id, :community_id, :article_id],
        prefix: "cms",
        name: :article_bindings_scope_identity_index
      )
    )
  end
end
