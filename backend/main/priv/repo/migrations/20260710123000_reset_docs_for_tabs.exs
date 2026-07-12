defmodule GroupherServer.Repo.Migrations.ResetDocsForTabs do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("""
    TRUNCATE TABLE
      #{@prefix}.doc_cover_pinned_items,
      #{@prefix}.doc_cover_items,
      #{@prefix}.doc_cover_groups,
      #{@prefix}.publish_release_tree_events,
      #{@prefix}.publish_release_articles,
      #{@prefix}.publish_releases,
      #{@prefix}.doc_tree_restore_audits,
      #{@prefix}.doc_tree_trash_items,
      #{@prefix}.doc_tree_events,
      #{@prefix}.doc_tree_snapshots,
      #{@prefix}.docs_site_states,
      #{@prefix}.doc_tree_nodes,
      #{@prefix}.docs
    RESTART IDENTITY CASCADE;
    """)

    execute("""
    INSERT INTO #{@prefix}.doc_tree_nodes (
      community_id,
      branch_id,
      node_id,
      stage,
      type,
      title,
      slug,
      index,
      hidden,
      ui_config,
      inserted_at,
      updated_at
    )
    SELECT
      branch.community_id,
      branch.id,
      'default:introduction:' || branch.id::text,
      stage.name,
      'tab',
      'Introduction',
      'introduction',
      0,
      false,
      '{}'::jsonb,
      NOW(),
      NOW()
    FROM #{@prefix}.docs_branches AS branch
    CROSS JOIN (VALUES ('draft'), ('public')) AS stage(name)
    WHERE branch.status = 'active';
    """)
  end

  def down do
    :ok
  end
end
