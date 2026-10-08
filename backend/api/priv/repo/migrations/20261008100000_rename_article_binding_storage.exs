defmodule GroupherServer.Repo.Migrations.RenameArticleBindingStorage do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("ALTER TABLE #{@prefix}.article_communities RENAME TO article_bindings")
    execute("ALTER TABLE #{@prefix}.article_community_tags RENAME TO article_binding_tags")

    execute(
      "ALTER TABLE #{@prefix}.article_binding_tags " <>
        "RENAME COLUMN article_community_id TO article_binding_id"
    )

    execute(
      "ALTER TABLE #{@prefix}.pinned_articles " <>
        "RENAME COLUMN article_community_id TO article_binding_id"
    )

    execute(
      "ALTER TABLE #{@prefix}.kanban_states " <>
        "RENAME COLUMN article_community_id TO article_binding_id"
    )

    rename_index(:article_communities_article_id_community_id_index,
      :article_bindings_article_id_community_id_index)

    rename_index(:article_communities_community_inner_id_index,
      :article_bindings_community_inner_id_index)

    rename_index(:pinned_articles_article_community_id_index, :pinned_articles_article_binding_id_index)

    rename_constraint(:article_communities_pkey, :article_bindings_pkey)
    rename_constraint(:article_communities_article_id_fkey, :article_bindings_article_id_fkey)
    rename_constraint(:article_communities_community_id_fkey, :article_bindings_community_id_fkey)
    rename_constraint(:article_community_tags_pkey, :article_binding_tags_pkey)

    rename_constraint(
      :article_community_tags_article_community_id_fkey,
      :article_binding_tags_article_binding_id_fkey
    )

    rename_constraint(:article_community_tags_tag_id_fkey, :article_binding_tags_tag_id_fkey)

    rename_constraint(
      :pinned_articles_article_community_id_fkey,
      :pinned_articles_article_binding_id_fkey
    )

    rename_constraint(:kanban_states_article_community_id_fkey, :kanban_states_article_binding_id_fkey)
  end

  def down do
    rename_constraint(:kanban_states_article_binding_id_fkey, :kanban_states_article_community_id_fkey)

    rename_constraint(
      :pinned_articles_article_binding_id_fkey,
      :pinned_articles_article_community_id_fkey
    )

    rename_constraint(:article_binding_tags_tag_id_fkey, :article_community_tags_tag_id_fkey)

    rename_constraint(
      :article_binding_tags_article_binding_id_fkey,
      :article_community_tags_article_community_id_fkey
    )

    rename_constraint(:article_binding_tags_pkey, :article_community_tags_pkey)
    rename_constraint(:article_bindings_community_id_fkey, :article_communities_community_id_fkey)
    rename_constraint(:article_bindings_article_id_fkey, :article_communities_article_id_fkey)
    rename_constraint(:article_bindings_pkey, :article_communities_pkey)

    rename_index(:pinned_articles_article_binding_id_index, :pinned_articles_article_community_id_index)

    rename_index(:article_bindings_community_inner_id_index,
      :article_communities_community_inner_id_index)

    rename_index(:article_bindings_article_id_community_id_index,
      :article_communities_article_id_community_id_index)

    execute(
      "ALTER TABLE #{@prefix}.kanban_states " <>
        "RENAME COLUMN article_binding_id TO article_community_id"
    )

    execute(
      "ALTER TABLE #{@prefix}.pinned_articles " <>
        "RENAME COLUMN article_binding_id TO article_community_id"
    )

    execute(
      "ALTER TABLE #{@prefix}.article_binding_tags " <>
        "RENAME COLUMN article_binding_id TO article_community_id"
    )

    execute("ALTER TABLE #{@prefix}.article_binding_tags RENAME TO article_community_tags")
    execute("ALTER TABLE #{@prefix}.article_bindings RENAME TO article_communities")
  end

  defp rename_index(from, to) do
    execute("ALTER INDEX #{@prefix}.#{from} RENAME TO #{to}")
  end

  defp rename_constraint(from, to) do
    execute(
      "ALTER TABLE #{@prefix}.#{constraint_table(from)} " <>
        "RENAME CONSTRAINT #{from} TO #{to}"
    )
  end

  defp constraint_table(name) do
    cond do
      String.starts_with?(Atom.to_string(name), "article_communities_") -> "article_bindings"
      String.starts_with?(Atom.to_string(name), "article_bindings_") -> "article_bindings"
      String.starts_with?(Atom.to_string(name), "article_community_tags_") -> "article_binding_tags"
      String.starts_with?(Atom.to_string(name), "article_binding_tags_") -> "article_binding_tags"
      String.starts_with?(Atom.to_string(name), "pinned_articles_") -> "pinned_articles"
      String.starts_with?(Atom.to_string(name), "kanban_states_") -> "kanban_states"
    end
  end
end
