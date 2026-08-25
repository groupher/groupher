defmodule GroupherServer.Repo.Migrations.RebuildArticleVersioningFoundation do
  use Ecto.Migration

  @moduledoc """
  Rebuilds the CMS draft/version foundation around a shared Article identity.

      docs_branches                       article_branches
      docs.doc_id                         *.article_hash_id
      article_snapshots.doc_id            article_snapshots.article_hash_id
      publish_releases                    doc_publish_releases

  The application is not live, so this is an intentional one-way migration.
  Runtime code has no legacy read/write path after this migration.
  """

  @prefix "cms"
  @threads ~w(post blog changelog doc)

  def up do
    execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    rename(table(:docs_branches, prefix: @prefix), to: table(:article_branches, prefix: @prefix))

    rename(
      table(:publish_releases, prefix: @prefix),
      to: table(:doc_publish_releases, prefix: @prefix)
    )

    rename(
      table(:publish_release_articles, prefix: @prefix),
      to: table(:doc_publish_release_articles, prefix: @prefix)
    )

    rename(
      table(:publish_release_tree_events, prefix: @prefix),
      to: table(:doc_publish_release_tree_events, prefix: @prefix)
    )

    rename(table(:article_branches, prefix: @prefix), :kind, to: :type)

    execute(
      "ALTER TABLE #{@prefix}.article_branches DROP CONSTRAINT IF EXISTS docs_branches_kind_check;"
    )

    execute(
      "ALTER TABLE #{@prefix}.article_branches DROP CONSTRAINT IF EXISTS docs_branches_status_check;"
    )

    rename(table(:docs, prefix: @prefix), :doc_id, to: :article_hash_id)
    rename(table(:article_snapshots, prefix: @prefix), :doc_id, to: :article_hash_id)
    rename(table(:article_snapshots, prefix: @prefix), :snapshot_number, to: :revision_number)

    alter table(:article_branches, prefix: @prefix) do
      add(:thread, :string)

      add(
        :source_branch_id,
        references(:article_branches, prefix: @prefix, on_delete: :nilify_all)
      )

      remove(:base_release_id)
      remove(:base_snapshot_id)
    end

    execute("UPDATE #{@prefix}.article_branches SET thread = 'doc' WHERE thread IS NULL;")

    alter table(:article_branches, prefix: @prefix) do
      modify(:thread, :string, null: false)
    end

    drop_if_exists(
      index(:article_branches, [:community_id, :slug],
        prefix: @prefix,
        name: :docs_branches_community_slug_index
      )
    )

    execute("DROP INDEX IF EXISTS #{@prefix}.docs_branches_community_slug_index;")

    create(
      unique_index(:article_branches, [:community_id, :thread, :slug],
        prefix: @prefix,
        name: :article_branches_community_thread_slug_index
      )
    )

    create(
      unique_index(:article_branches, [:community_id, :thread],
        prefix: @prefix,
        where: "type = 'main'",
        name: :article_branches_main_index
      )
    )

    create(index(:article_branches, [:source_branch_id], prefix: @prefix))

    create(
      constraint(:article_branches, :article_branches_thread_check,
        prefix: @prefix,
        check: "thread IN ('post', 'blog', 'changelog', 'doc')"
      )
    )

    create(
      constraint(:article_branches, :article_branches_type_check,
        prefix: @prefix,
        check: "type IN ('main', 'preview')"
      )
    )

    create(
      constraint(:article_branches, :article_branches_status_check,
        prefix: @prefix,
        check: "status IN ('active', 'archived')"
      )
    )

    seed_main_branches()
    add_article_version_fields(:posts, "post")
    add_article_version_fields(:blogs, "blog")
    add_article_version_fields(:changelogs, "changelog")
    normalize_docs()
    rebuild_snapshots()
    rename_doc_release_indexes()
  end

  def down do
    raise "RebuildArticleVersioningFoundation is intentionally irreversible"
  end

  defp seed_main_branches do
    values =
      @threads
      |> Enum.map(&"('#{&1}')")
      |> Enum.join(", ")

    execute("""
    INSERT INTO #{@prefix}.article_branches
      (community_id, thread, slug, title, type, status, inserted_at, updated_at)
    SELECT communities.id, thread.value, 'main', 'main', 'main', 'active', NOW(), NOW()
    FROM #{@prefix}.communities AS communities
    CROSS JOIN (VALUES #{values}) AS thread(value)
    ON CONFLICT (community_id, thread, slug) DO NOTHING;
    """)
  end

  defp add_article_version_fields(table, thread) do
    alter table(table, prefix: @prefix) do
      add(:article_hash_id, :uuid)
      add(:branch_id, references(:article_branches, prefix: @prefix, on_delete: :delete_all))
      add(:stage, :string, default: "public")
      add(:content_hash, :string)
      add(:schema_version, :integer, default: 1)
    end

    flush()

    execute("""
    UPDATE #{@prefix}.#{table} AS article
    SET article_hash_id = gen_random_uuid(),
        branch_id = branch.id,
        stage = 'public'
    FROM #{@prefix}.article_branches AS branch
    WHERE branch.community_id = article.community_id
      AND branch.thread = '#{thread}'
      AND branch.type = 'main';
    """)

    alter table(table, prefix: @prefix) do
      modify(:article_hash_id, :uuid, null: false)
      modify(:branch_id, :bigint, null: false)
      modify(:stage, :string, null: false)
      modify(:schema_version, :integer, null: false)
    end

    create(
      unique_index(table, [:branch_id, :article_hash_id, :stage],
        prefix: @prefix,
        name: :"#{table}_branch_article_hash_stage_index"
      )
    )

    create(index(table, [:article_hash_id], prefix: @prefix))
    create(index(table, [:branch_id, :stage], prefix: @prefix))

    create(
      constraint(table, :"#{table}_stage_check",
        prefix: @prefix,
        check: "stage IN ('draft', 'public')"
      )
    )
  end

  defp normalize_docs do
    execute("DROP INDEX IF EXISTS #{@prefix}.docs_community_stage_doc_id_index;")
    execute("DROP INDEX IF EXISTS #{@prefix}.docs_community_id_stage_doc_id_index;")

    create(
      unique_index(:docs, [:branch_id, :article_hash_id, :stage],
        prefix: @prefix,
        name: :docs_branch_article_hash_stage_index
      )
    )

    create(index(:docs, [:article_hash_id], prefix: @prefix))
  end

  defp rebuild_snapshots do
    alter table(:article_snapshots, prefix: @prefix) do
      add(:hash_id, :uuid)
      add(:action, :string)

      add(
        :parent_snapshot_id,
        references(:article_snapshots, prefix: @prefix, on_delete: :nilify_all)
      )

      add(
        :source_snapshot_id,
        references(:article_snapshots, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:data, :map, null: false, default: %{})
      add(:message, :text)
    end

    execute("""
    UPDATE #{@prefix}.article_snapshots
    SET action = CASE stage WHEN 'public' THEN 'publish' ELSE 'checkpoint' END,
        hash_id = gen_random_uuid();
    """)

    alter table(:article_snapshots, prefix: @prefix) do
      modify(:action, :string, null: false)
      modify(:hash_id, :uuid, null: false)
      modify(:branch_id, :bigint, null: false)
      modify(:article_hash_id, :uuid, null: false)
    end

    execute("DROP INDEX IF EXISTS #{@prefix}.article_snapshots_doc_id_index;")
    execute("DROP INDEX IF EXISTS #{@prefix}.article_snapshots_thread_doc_id_index;")

    create(index(:article_snapshots, [:article_hash_id], prefix: @prefix))
    create(unique_index(:article_snapshots, [:hash_id], prefix: @prefix))
    create(index(:article_snapshots, [:branch_id, :article_hash_id], prefix: @prefix))

    create(
      unique_index(
        :article_snapshots,
        [:thread, :branch_id, :article_hash_id, :revision_number],
        prefix: @prefix,
        name: :article_snapshots_revision_index
      )
    )

    create(
      constraint(:article_snapshots, :article_snapshots_action_check,
        prefix: @prefix,
        check: "action IN ('checkpoint', 'publish', 'fork', 'promote', 'restore')"
      )
    )

    execute(
      "ALTER TABLE #{@prefix}.article_snapshots DROP CONSTRAINT IF EXISTS article_snapshots_target_check;"
    )

    create(
      constraint(:article_snapshots, :article_snapshots_target_check,
        prefix: @prefix,
        check: "article_hash_id IS NOT NULL AND branch_id IS NOT NULL"
      )
    )
  end

  defp rename_doc_release_indexes do
    execute(
      "ALTER INDEX IF EXISTS #{@prefix}.publish_releases_branch_number_index RENAME TO doc_publish_releases_branch_number_index;"
    )

    execute(
      "ALTER INDEX IF EXISTS #{@prefix}.publish_releases_branch_version_slug_index RENAME TO doc_publish_releases_branch_version_slug_index;"
    )

    execute(
      "ALTER INDEX IF EXISTS #{@prefix}.publish_release_articles_release_id_index RENAME TO doc_publish_release_articles_release_id_index;"
    )

    execute(
      "ALTER INDEX IF EXISTS #{@prefix}.publish_release_tree_events_release_id_index RENAME TO doc_publish_release_tree_events_release_id_index;"
    )
  end
end
