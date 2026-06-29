defmodule GroupherServer.Repo.Migrations.RepairArticleWorkspaceTables do
  use Ecto.Migration

  @prefix "cms"

  def up do
    create_article_workspaces_if_missing()
    create_article_snapshots_if_missing()
    copy_legacy_article_drafts()
  end

  def down do
    :ok
  end

  defp create_article_workspaces_if_missing do
    create_if_not_exists table(:article_workspaces, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:article_id, :bigint)
      add(:article_thread, :string, null: false)
      add(:stage, :string, null: false)
      add(:author_id, references(:authors, prefix: @prefix, on_delete: :nilify_all))
      add(:title, :string, null: false)
      add(:subtitle, :string)
      add(:slug, :string, null: false)
      add(:digest, :string, null: false)
      add(:template_key, :string)
      add(:json, :text, null: false)
      add(:markdown, :text)
      add(:markdown_toc, :map)
      add(:html, :text)
      add(:xml, :text)
      add(:rss, :text)
      add(:plain_text, :text)
      add(:content_hash, :string)
      add(:schema_version, :integer, null: false, default: 1)

      timestamps()
    end

    create_if_not_exists(index(:article_workspaces, [:community_id], prefix: @prefix))

    create_if_not_exists(
      index(:article_workspaces, [:article_thread, :article_id], prefix: @prefix)
    )

    create_if_not_exists(index(:article_workspaces, [:author_id], prefix: @prefix))
    create_if_not_exists(index(:article_workspaces, [:content_hash], prefix: @prefix))

    create_if_not_exists(
      unique_index(:article_workspaces, [:community_id, :template_key],
        prefix: @prefix,
        name: :article_workspaces_community_id_template_key_index
      )
    )

    create_if_not_exists(
      unique_index(:article_workspaces, [:community_id, :article_thread, :stage, :article_id],
        prefix: @prefix,
        where: "article_id IS NOT NULL",
        name: :article_workspaces_identity_stage_index
      )
    )

    create_check_constraint_if_missing(
      :article_workspaces,
      :article_workspaces_stage_check,
      "stage IN ('draft')"
    )

    create_check_constraint_if_missing(
      :article_workspaces,
      :article_workspaces_article_thread_check,
      "article_thread IN ('post', 'doc', 'changelog', 'blog')"
    )
  end

  defp create_article_snapshots_if_missing do
    create_if_not_exists table(:article_snapshots, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:article_id, :bigint)

      add(
        :workspace_id,
        references(:article_workspaces, prefix: @prefix, on_delete: :delete_all)
      )

      add(:article_thread, :string, null: false)
      add(:stage, :string, null: false)
      add(:author_id, references(:authors, prefix: @prefix, on_delete: :nilify_all))
      add(:title, :string, null: false)
      add(:slug, :string)
      add(:subtitle, :string)
      add(:digest, :text)
      add(:document_json, :text, null: false)
      add(:content_hash, :string, null: false)
      add(:snapshot_number, :integer, null: false)
      add(:schema_version, :integer, null: false, default: 1)

      timestamps()
    end

    create_if_not_exists(index(:article_snapshots, [:community_id], prefix: @prefix))

    create_if_not_exists(
      index(:article_snapshots, [:article_thread, :article_id], prefix: @prefix)
    )

    create_if_not_exists(
      index(:article_snapshots, [:article_thread, :workspace_id], prefix: @prefix)
    )

    create_if_not_exists(index(:article_snapshots, [:stage], prefix: @prefix))
    create_if_not_exists(index(:article_snapshots, [:content_hash], prefix: @prefix))
    create_if_not_exists(index(:article_snapshots, [:inserted_at], prefix: @prefix))

    create_check_constraint_if_missing(
      :article_snapshots,
      :article_snapshots_target_check,
      "(stage = 'draft' AND workspace_id IS NOT NULL AND article_id IS NULL) OR (stage = 'public' AND article_id IS NOT NULL AND workspace_id IS NULL)"
    )

    create_check_constraint_if_missing(
      :article_snapshots,
      :article_snapshots_stage_check,
      "stage IN ('draft', 'public')"
    )

    create_check_constraint_if_missing(
      :article_snapshots,
      :article_snapshots_article_thread_check,
      "article_thread IN ('post', 'doc', 'changelog', 'blog')"
    )
  end

  defp copy_legacy_article_drafts do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.article_drafts') IS NOT NULL
        AND to_regclass('#{@prefix}.article_workspaces') IS NOT NULL
      THEN
        INSERT INTO #{@prefix}.article_workspaces (
          id,
          community_id,
          article_id,
          article_thread,
          stage,
          author_id,
          title,
          subtitle,
          slug,
          digest,
          template_key,
          json,
          markdown,
          markdown_toc,
          html,
          xml,
          rss,
          plain_text,
          content_hash,
          schema_version,
          inserted_at,
          updated_at
        )
        SELECT
          id,
          community_id,
          article_id,
          COALESCE(thread, 'doc'),
          'draft',
          author_id,
          title,
          NULL,
          COALESCE(slug, ''),
          digest,
          template_key,
          json,
          markdown,
          markdown_toc,
          html,
          xml,
          rss,
          plain_text,
          content_hash,
          schema_version,
          inserted_at,
          updated_at
        FROM #{@prefix}.article_drafts
        ON CONFLICT (id) DO NOTHING;

        PERFORM setval(
          pg_get_serial_sequence('#{@prefix}.article_workspaces', 'id'),
          GREATEST(
            COALESCE((SELECT MAX(id) FROM #{@prefix}.article_workspaces), 1),
            1
          )
        );
      END IF;
    END
    $$;
    """)
  end

  defp create_check_constraint_if_missing(table, name, check) do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.#{table}') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE n.nspname = '#{@prefix}'
            AND t.relname = '#{table}'
            AND c.conname = '#{name}'
        )
      THEN
        ALTER TABLE #{@prefix}.#{table}
          ADD CONSTRAINT #{name} CHECK (#{check});
      END IF;
    END
    $$;
    """)
  end
end
