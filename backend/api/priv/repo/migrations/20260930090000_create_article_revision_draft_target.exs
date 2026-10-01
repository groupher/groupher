defmodule GroupherServer.Repo.Migrations.CreateArticleRevisionDraftTarget do
  use Ecto.Migration

  @prefix "cms"
  @threads "('post', 'blog', 'changelog', 'doc')"

  def change do
    create table(:articles, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)

      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:thread, :string, null: false)
      add(:author_id, references(:authors, prefix: @prefix, on_delete: :restrict), null: false)
      add(:inner_id, :bigint)
      add(:moderation_state, :string, null: false, default: "legal")
      add(:illegal_reason, :text)
      add(:illegal_words, {:array, :string}, null: false, default: [])
      add(:active_at, :timestamptz)
      add(:is_sunk, :boolean, null: false, default: false)
      add(:last_active_at, :timestamptz)
      add(:is_edited, :boolean, null: false, default: false)
      add(:comments_locked, :boolean, null: false, default: false)
      add(:next_floor, :bigint, null: false, default: 1)
      add(:next_comment_inner_id, :bigint, null: false, default: 1)
      timestamps()
    end

    create(index(:articles, [:community_id, :thread], prefix: @prefix))

    alter table(:article_lifecycles, prefix: @prefix) do
      modify(:article_hash_id, :uuid, null: true, from: {:uuid, null: false})

      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all)
      )
    end

    create(
      unique_index(:article_lifecycles, [:article_id],
        prefix: @prefix,
        where: "article_id IS NOT NULL",
        name: :article_lifecycles_article_id_index
      )
    )

    alter table(:doc_lifecycles, prefix: @prefix) do
      modify(:article_hash_id, :uuid, null: true, from: {:uuid, null: false})

      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all)
      )
    end

    create(
      unique_index(:doc_lifecycles, [:article_id, :branch_id],
        prefix: @prefix,
        where: "article_id IS NOT NULL",
        name: :doc_lifecycles_article_branch_index
      )
    )

    create(
      unique_index(:articles, [:community_id, :thread, :inner_id],
        prefix: @prefix,
        where: "inner_id IS NOT NULL",
        name: :articles_public_inner_id_index
      )
    )

    create(
      constraint(:articles, :articles_thread_check,
        prefix: @prefix,
        check: "thread IN #{@threads}"
      )
    )

    create(
      constraint(:articles, :articles_moderation_state_check,
        prefix: @prefix,
        check: "moderation_state IN ('legal', 'audit_failed', 'illegal')"
      )
    )

    create table(:article_inner_id_counters, primary_key: false, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:thread, :string, primary_key: true)
      add(:next_inner_id, :bigint, null: false, default: 1)
    end

    create(
      constraint(:article_inner_id_counters, :article_inner_id_counters_thread_check,
        prefix: @prefix,
        check: "thread IN #{@threads}"
      )
    )

    create table(:article_communities, prefix: @prefix) do
      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:role, :string, null: false)
      add(:visible, :boolean, null: false, default: true)
      timestamps()
    end

    create(unique_index(:article_communities, [:article_id, :community_id], prefix: @prefix))

    create(
      unique_index(:article_communities, [:article_id],
        prefix: @prefix,
        where: "role = 'home'",
        name: :article_communities_home_index
      )
    )

    create(
      constraint(:article_communities, :article_communities_role_check,
        prefix: @prefix,
        check: "role IN ('home', 'mirror')"
      )
    )

    create table(:article_community_tags, primary_key: false, prefix: @prefix) do
      add(
        :article_community_id,
        references(:article_communities, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:tag_id, references(:community_tags, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )
    end

    alter table(:pinned_articles, prefix: @prefix) do
      add(
        :article_community_id,
        references(:article_communities, prefix: @prefix, on_delete: :delete_all)
      )
    end

    create(
      unique_index(:pinned_articles, [:article_community_id],
        prefix: @prefix,
        where: "article_community_id IS NOT NULL"
      )
    )

    create table(:doc_branch_states, prefix: @prefix) do
      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:branch_id, references(:doc_branches, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:moderation_state, :string, null: false, default: "legal")
      add(:illegal_reason, :text)
      add(:illegal_words, {:array, :string}, null: false, default: [])
      add(:active_at, :timestamptz)
      add(:is_sunk, :boolean, null: false, default: false)
      add(:last_active_at, :timestamptz)
      add(:is_edited, :boolean, null: false, default: false)
      add(:comments_locked, :boolean, null: false, default: false)
      add(:next_floor, :bigint, null: false, default: 1)
      add(:next_comment_inner_id, :bigint, null: false, default: 1)
      timestamps()
    end

    create(unique_index(:doc_branch_states, [:article_id, :branch_id], prefix: @prefix))

    create(
      constraint(:doc_branch_states, :doc_branch_states_moderation_state_check,
        prefix: @prefix,
        check: "moderation_state IN ('legal', 'audit_failed', 'illegal')"
      )
    )

    create table(:article_body_drafts, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)
      body_fields()
      timestamps()
    end

    create table(:article_body_snapshots, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)
      body_fields()
      timestamps(updated_at: false)
    end

    create(unique_index(:article_body_snapshots, [:body_hash, :schema_version], prefix: @prefix))

    create table(:article_revisions, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)

      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :body_snapshot_id,
        references(:article_body_snapshots, type: :uuid, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:title, :string, null: false)
      add(:digest, :text, null: false)
      add(:slug, :string)
      add(:content_hash, :string, null: false)
      add(:schema_version, :integer, null: false, default: 1)
      add(:cleanup_after, :timestamptz, null: false)
      timestamps(updated_at: false)
    end

    create(index(:article_revisions, [:article_id, :inserted_at], prefix: @prefix))
    create(index(:article_revisions, [:cleanup_after], prefix: @prefix))

    create table(:article_drafts, primary_key: false, prefix: @prefix) do
      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(
        :base_revision_id,
        references(:article_revisions, type: :uuid, prefix: @prefix, on_delete: :nilify_all)
      )

      add(
        :body_draft_id,
        references(:article_body_drafts, type: :uuid, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:version, :bigint, null: false, default: 1)
      add(:title, :string, null: false)
      add(:digest, :text, null: false)
      add(:slug, :string)
      add(:content_hash, :string, null: false)

      add(:updated_by_id, references(:authors, prefix: @prefix, on_delete: :nilify_all),
        null: false
      )

      timestamps()
    end

    create(index(:article_drafts, [:base_revision_id], prefix: @prefix))
    create(index(:article_drafts, [:content_hash], prefix: @prefix))

    create table(:article_publics, primary_key: false, prefix: @prefix) do
      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(
        :revision_id,
        references(:article_revisions, type: :uuid, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:published_at, :timestamptz, null: false)

      add(:published_by_id, references(:authors, prefix: @prefix, on_delete: :nilify_all),
        null: false
      )

      add(:publication_version, :bigint, null: false, default: 1)
      public_projection_fields()
      add(:active_at, :timestamptz)
      add(:visible, :boolean, null: false, default: true)
      timestamps()
    end

    create(index(:article_publics, [:revision_id], prefix: @prefix))
    create(index(:article_publics, [:visible, :active_at], prefix: @prefix))

    create_typed_draft(:post_drafts)
    create_typed_draft(:blog_drafts)
    create_typed_draft(:changelog_drafts)
    create_typed_revision(:post_revisions)
    create_typed_revision(:blog_revisions)
    create_typed_revision(:changelog_revisions)

    create table(:doc_drafts, prefix: @prefix) do
      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:branch_id, references(:doc_branches, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :base_revision_id,
        references(:article_revisions, type: :uuid, prefix: @prefix, on_delete: :nilify_all)
      )

      add(
        :source_revision_id,
        references(:article_revisions, type: :uuid, prefix: @prefix, on_delete: :nilify_all)
      )

      add(
        :body_draft_id,
        references(:article_body_drafts, type: :uuid, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:version, :bigint, null: false, default: 1)
      add(:title, :string, null: false)
      add(:digest, :text, null: false)
      add(:slug, :string)
      add(:subtitle, :string)
      add(:link_addr, :string)
      add(:template_key, :string)
      add(:content_hash, :string, null: false)

      add(:updated_by_id, references(:authors, prefix: @prefix, on_delete: :nilify_all),
        null: false
      )

      timestamps()
    end

    create(unique_index(:doc_drafts, [:article_id, :branch_id], prefix: @prefix))

    create table(:doc_revisions, primary_key: false, prefix: @prefix) do
      add(
        :revision_id,
        references(:article_revisions, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:subtitle, :string)
      add(:link_addr, :string)
      add(:template_key, :string)
      add(:cover_url, :string)
      add(:cover_url_dark, :string)
    end

    create table(:doc_branch_versions, prefix: @prefix) do
      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:branch_id, references(:doc_branches, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :revision_id,
        references(:article_revisions, type: :uuid, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:version_number, :bigint, null: false)

      add(:published_by_id, references(:authors, prefix: @prefix, on_delete: :nilify_all),
        null: false
      )

      add(:published_at, :timestamptz, null: false)
      add(:message, :text)
      timestamps(updated_at: false)
    end

    create(
      unique_index(:doc_branch_versions, [:article_id, :branch_id, :version_number],
        prefix: @prefix
      )
    )

    create(index(:doc_branch_versions, [:revision_id], prefix: @prefix))

    create table(:doc_branch_version_counters, primary_key: false, prefix: @prefix) do
      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:branch_id, references(:doc_branches, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:next_version_number, :bigint, null: false, default: 1)
    end

    create table(:doc_publics, prefix: @prefix) do
      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:branch_id, references(:doc_branches, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :branch_version_id,
        references(:doc_branch_versions, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:published_at, :timestamptz, null: false)

      add(:published_by_id, references(:authors, prefix: @prefix, on_delete: :nilify_all),
        null: false
      )

      add(:publication_version, :bigint, null: false, default: 1)
      public_projection_fields()
      add(:subtitle, :string)
      add(:active_at, :timestamptz)
      add(:is_edited, :boolean, null: false, default: false)
      add(:visible, :boolean, null: false, default: true)
      timestamps()
    end

    create(unique_index(:doc_publics, [:article_id, :branch_id], prefix: @prefix))
    create(unique_index(:doc_publics, [:branch_version_id], prefix: @prefix))

    create table(:post_states, primary_key: false, prefix: @prefix) do
      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:cat, :string)
      add(:status, :string)
      timestamps()
    end

    for thread <- ~w(post blog changelog) do
      create_tag_tables(thread, false)
    end

    create_tag_tables("doc", true)

    create table(:revision_covers, prefix: @prefix) do
      add(
        :revision_id,
        references(:article_revisions, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:asset_id, references(:community_assets, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:theme, :string, null: false)
    end

    create(unique_index(:revision_covers, [:revision_id, :theme], prefix: @prefix))

    create(
      constraint(:revision_covers, :revision_covers_theme_check,
        prefix: @prefix,
        check: "theme IN ('light', 'dark')"
      )
    )

    create table(:revision_cover_edits, primary_key: false, prefix: @prefix) do
      add(
        :revision_id,
        references(:article_revisions, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:canvas_width, :integer)
      add(:canvas_height, :integer)
      add(:version, :integer, null: false, default: 1)

      add(
        :light_background_id,
        references(:cover_backgrounds, prefix: @prefix, on_delete: :nilify_all)
      )

      add(
        :light_original_background_id,
        references(:cover_backgrounds, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:light_images, {:array, :map}, null: false, default: [])

      add(
        :dark_background_id,
        references(:cover_backgrounds, prefix: @prefix, on_delete: :nilify_all)
      )

      add(
        :dark_original_background_id,
        references(:cover_backgrounds, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:dark_images, {:array, :map}, null: false, default: [])
    end
  end

  defp body_fields do
    add(:json, :text, null: false)
    add(:markdown, :text)
    add(:markdown_toc, :map)
    add(:html, :text)
    add(:xml, :text)
    add(:rss, :text)
    add(:plain_text, :text)
    add(:thumbnail, :map)
    add(:body_hash, :string, null: false)
    add(:schema_version, :integer, null: false, default: 1)
  end

  defp public_projection_fields do
    add(:title, :string, null: false)
    add(:digest, :text, null: false)
    add(:slug, :string)
    add(:body_hash, :string, null: false)
    add(:excerpt, :text)
    add(:thumbnail, :map)
  end

  defp create_typed_draft(table_name) do
    create table(table_name, primary_key: false, prefix: @prefix) do
      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:copy_right, :string)
      add(:link_addr, :string)
      add(:cover_url, :string)
      add(:cover_url_dark, :string)
      timestamps()
    end
  end

  defp create_typed_revision(table_name) do
    create table(table_name, primary_key: false, prefix: @prefix) do
      add(
        :revision_id,
        references(:article_revisions, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:copy_right, :string)
      add(:link_addr, :string)
      add(:cover_url, :string)
      add(:cover_url_dark, :string)
    end
  end

  defp create_tag_tables(thread, branch_scoped?) do
    draft_table = String.to_atom("#{thread}_draft_tags")
    revision_table = String.to_atom("#{thread}_revision_tags")

    create table(draft_table, primary_key: false, prefix: @prefix) do
      add(
        :article_id,
        references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      if branch_scoped?,
        do:
          add(:branch_id, references(:doc_branches, prefix: @prefix, on_delete: :delete_all),
            primary_key: true
          )

      add(:tag_id, references(:community_tags, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )
    end

    create table(revision_table, primary_key: false, prefix: @prefix) do
      add(
        :revision_id,
        references(:article_revisions, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:tag_id, references(:community_tags, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )
    end
  end
end
