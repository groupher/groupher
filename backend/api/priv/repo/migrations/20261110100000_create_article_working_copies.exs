defmodule GroupherServer.Repo.Migrations.CreateArticleWorkingCopies do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:cover_edit_working_copies, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)
      add(:format_version, :integer, null: false, default: 1)
      add(:canvas_width, :integer)
      add(:canvas_height, :integer)
      add(:light, :map, null: false, default: %{})
      add(:dark, :map, null: false, default: %{})
      timestamps()
    end

    create(
      constraint(:cover_edit_working_copies, :cover_edit_working_copies_version_check,
        prefix: @prefix,
        check: "format_version > 0"
      )
    )

    create(
      constraint(:cover_edit_working_copies, :cover_edit_working_copies_dimensions_check,
        prefix: @prefix,
        check:
          "(canvas_width IS NULL AND canvas_height IS NULL) OR " <>
            "(canvas_width > 0 AND canvas_height > 0)"
      )
    )

    create table(:article_working_copies, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)

      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:scope_kind, :string, null: false)
      add(:scope_id, :uuid, null: false)
      add(:revision, :bigint, null: false, default: 1)
      add(:title, :text, null: false, default: "")
      add(:digest, :text, null: false, default: "")
      add(:slug, :string)
      add(:body_json, :text, null: false)
      add(:body_schema_version, :integer, null: false, default: 1)
      add(:body_markdown, :text, null: false, default: "")
      add(:body_html, :text, null: false, default: "")
      add(:body_markdown_toc, :map, null: false, default: %{items: []})
      add(:body_plain_text, :text, null: false, default: "")
      add(:body_thumbnail, :map, null: false, default: %{version: 1, blocks: []})
      add(:body_xml, :text)
      add(:body_rss, :text)
      add(:cover_edit_working_copy_id, :uuid)

      add(:created_by_id, references(:users, prefix: "account", on_delete: :restrict),
        null: false
      )

      add(:updated_by_id, references(:users, prefix: "account", on_delete: :restrict),
        null: false
      )

      timestamps()
    end

    create(
      unique_index(:article_working_copies, [:article_id, :scope_kind, :scope_id],
        prefix: @prefix
      )
    )

    create(unique_index(:article_working_copies, [:article_id, :id], prefix: @prefix))

    create(
      unique_index(:article_working_copies, [:cover_edit_working_copy_id],
        prefix: @prefix,
        where: "cover_edit_working_copy_id IS NOT NULL"
      )
    )

    create(
      constraint(:article_working_copies, :article_working_copies_scope_kind_check,
        prefix: @prefix,
        check: "scope_kind IN ('default', 'workspace')"
      )
    )

    create(
      constraint(:article_working_copies, :article_working_copies_default_scope_check,
        prefix: @prefix,
        check: "scope_kind <> 'default' OR scope_id = article_id"
      )
    )

    create(
      constraint(:article_working_copies, :article_working_copies_revision_check,
        prefix: @prefix,
        check: "revision > 0 AND body_schema_version > 0"
      )
    )

    execute(
      """
      ALTER TABLE cms.article_working_copies
      ADD CONSTRAINT article_working_copies_cover_edit_fkey
      FOREIGN KEY (cover_edit_working_copy_id)
      REFERENCES cms.cover_edit_working_copies(id) ON DELETE RESTRICT
      """,
      """
      ALTER TABLE cms.article_working_copies
      DROP CONSTRAINT article_working_copies_cover_edit_fkey
      """
    )

    create table(:article_working_copy_tags, primary_key: false, prefix: @prefix) do
      add(
        :working_copy_id,
        references(:article_working_copies, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        null: false,
        primary_key: true
      )

      add(
        :tag_id,
        references(:community_tags, prefix: @prefix, on_delete: :restrict),
        null: false,
        primary_key: true
      )
    end

    create(index(:article_working_copy_tags, [:tag_id, :working_copy_id], prefix: @prefix))
  end
end
