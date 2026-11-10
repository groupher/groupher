defmodule GroupherServer.Repo.Migrations.CreateArticleContentSnapshots do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:cover_edit_snapshots, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)
      add(:format_version, :integer, null: false)
      add(:canvas_width, :integer)
      add(:canvas_height, :integer)
      add(:light, :map, null: false)
      add(:dark, :map, null: false)
      add(:captured_at, :timestamptz, null: false)
      timestamps(updated_at: false)
    end

    create(
      constraint(:cover_edit_snapshots, :cover_edit_snapshots_version_check,
        prefix: @prefix,
        check: "format_version > 0"
      )
    )

    create(
      constraint(:cover_edit_snapshots, :cover_edit_snapshots_dimensions_check,
        prefix: @prefix,
        check:
          "(canvas_width IS NULL AND canvas_height IS NULL) OR " <>
            "(canvas_width > 0 AND canvas_height > 0)"
      )
    )

    create table(:article_snapshots, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)

      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:source_working_copy_id, :uuid, null: false)
      add(:source_revision, :bigint, null: false)
      add(:title, :text, null: false)
      add(:digest, :text, null: false)
      add(:slug, :string)
      add(:body_json, :text, null: false)
      add(:body_schema_version, :integer, null: false)
      add(:body_markdown, :text, null: false)
      add(:body_html, :text, null: false)
      add(:body_markdown_toc, :map, null: false)
      add(:body_plain_text, :text, null: false)
      add(:body_thumbnail, :map, null: false)
      add(:body_xml, :text)
      add(:body_rss, :text)
      add(:cover_edit_snapshot_id, :uuid)

      add(:captured_by_id, references(:users, prefix: "account", on_delete: :restrict),
        null: false
      )

      add(:captured_at, :timestamptz, null: false)
      add(:causation_command_id, :uuid, null: false)
      timestamps(updated_at: false)
    end

    create(
      unique_index(:article_snapshots, [:source_working_copy_id, :source_revision],
        prefix: @prefix
      )
    )

    create(unique_index(:article_snapshots, [:article_id, :id], prefix: @prefix))
    create(index(:article_snapshots, [:article_id, :captured_at], prefix: @prefix))

    create(
      unique_index(:article_snapshots, [:cover_edit_snapshot_id],
        prefix: @prefix,
        where: "cover_edit_snapshot_id IS NOT NULL"
      )
    )

    create(
      constraint(:article_snapshots, :article_snapshots_source_revision_check,
        prefix: @prefix,
        check: "source_revision > 0 AND body_schema_version > 0"
      )
    )

    execute(
      """
      ALTER TABLE cms.article_snapshots
      ADD CONSTRAINT article_snapshots_cover_edit_snapshot_fkey
      FOREIGN KEY (cover_edit_snapshot_id)
      REFERENCES cms.cover_edit_snapshots(id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.article_snapshots DROP CONSTRAINT article_snapshots_cover_edit_snapshot_fkey"
    )

    create table(:article_snapshot_tags, primary_key: false, prefix: @prefix) do
      add(
        :snapshot_id,
        references(:article_snapshots, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        null: false,
        primary_key: true
      )

      add(:tag_id, references(:community_tags, prefix: @prefix, on_delete: :restrict),
        null: false,
        primary_key: true
      )
    end

    create(index(:article_snapshot_tags, [:tag_id, :snapshot_id], prefix: @prefix))

    create_typed_snapshot_tables()
    create_immutable_update_guard()
    create_thread_owner_guard()
  end

  defp create_typed_snapshot_tables do
    for thread <- ~w(post blog changelog) do
      create table(String.to_atom("article_snapshot_#{thread}s"),
               primary_key: false,
               prefix: @prefix
             ) do
        add(
          :snapshot_id,
          references(:article_snapshots, type: :uuid, prefix: @prefix, on_delete: :delete_all),
          primary_key: true
        )

        add(:copy_right, :text)
        add(:link_addr, :text)
        add(:cover_url, :text)
        add(:cover_url_dark, :text)
        timestamps(updated_at: false)
      end
    end

    create table(:article_snapshot_docs, primary_key: false, prefix: @prefix) do
      add(
        :snapshot_id,
        references(:article_snapshots, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:subtitle, :text)
      add(:link_addr, :text)
      add(:template_key, :string)
      add(:cover_url, :text)
      add(:cover_url_dark, :text)
      timestamps(updated_at: false)
    end
  end

  defp create_immutable_update_guard do
    execute(
      """
      CREATE OR REPLACE FUNCTION cms.reject_article_snapshot_update()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'article snapshot content is immutable' USING ERRCODE = '55000';
      END;
      $$
      """,
      "DROP FUNCTION IF EXISTS cms.reject_article_snapshot_update()"
    )

    for table <- ~w(article_snapshots cover_edit_snapshots article_snapshot_tags
                     article_snapshot_posts article_snapshot_blogs article_snapshot_changelogs
                     article_snapshot_docs) do
      execute(
        "CREATE TRIGGER #{table}_immutable_update BEFORE UPDATE ON cms.#{table} " <>
          "FOR EACH ROW EXECUTE FUNCTION cms.reject_article_snapshot_update()",
        "DROP TRIGGER IF EXISTS #{table}_immutable_update ON cms.#{table}"
      )
    end
  end

  defp create_thread_owner_guard do
    execute(
      """
      CREATE OR REPLACE FUNCTION cms.assert_article_snapshot_thread_field_owner()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE owner_thread text; expected_thread text;
      BEGIN
        expected_thread := regexp_replace(TG_TABLE_NAME, '^article_snapshot_(.*)s$', '\\1');
        IF TG_TABLE_NAME = 'article_snapshot_docs' THEN expected_thread := 'doc'; END IF;
        SELECT a.thread INTO owner_thread
        FROM cms.article_snapshots s
        JOIN cms.articles a ON a.id = s.article_id
        WHERE s.id = NEW.snapshot_id;
        IF owner_thread IS DISTINCT FROM expected_thread THEN
          RAISE EXCEPTION 'Article Snapshot thread extension does not match Article thread'
            USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$
      """,
      "DROP FUNCTION IF EXISTS cms.assert_article_snapshot_thread_field_owner()"
    )

    for table <- ~w(article_snapshot_posts article_snapshot_blogs
                     article_snapshot_changelogs article_snapshot_docs) do
      execute(
        "CREATE TRIGGER #{table}_owner_guard BEFORE INSERT OR UPDATE ON cms.#{table} " <>
          "FOR EACH ROW EXECUTE FUNCTION cms.assert_article_snapshot_thread_field_owner()",
        "DROP TRIGGER IF EXISTS #{table}_owner_guard ON cms.#{table}"
      )
    end
  end
end
