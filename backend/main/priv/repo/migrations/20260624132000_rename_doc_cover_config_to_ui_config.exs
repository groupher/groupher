defmodule GroupherServer.Repo.Migrations.RenameDocCoverConfigToUiConfig do
  use Ecto.Migration

  @prefix "cms"

  def up do
    alter table(:doc_cover_groups, prefix: @prefix) do
      add_if_not_exists(:ui_config, :map, null: false, default: %{})
    end

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = 'doc_cover_groups'
          AND column_name = 'layout'
      ) THEN
        UPDATE #{@prefix}.doc_cover_groups
        SET ui_config = COALESCE(ui_config, '{}'::jsonb) || jsonb_build_object('layout', layout)
        WHERE layout IS NOT NULL;
      END IF;
    END $$;
    """)

    alter table(:doc_cover_groups, prefix: @prefix) do
      remove_if_exists(:layout, :string)
    end

    alter table(:doc_cover_items, prefix: @prefix) do
      add_if_not_exists(:ui_config, :map, null: false, default: %{})
    end

    alter table(:doc_cover_pinned_items, prefix: @prefix) do
      add_if_not_exists(:ui_config, :map, null: false, default: %{})
    end

    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = '#{@prefix}'
          AND table_name = 'doc_cover_pinned_items'
          AND column_name = 'visual_config'
      ) THEN
        UPDATE #{@prefix}.doc_cover_pinned_items
        SET ui_config = COALESCE(ui_config, '{}'::jsonb) || COALESCE(visual_config, '{}'::jsonb)
        WHERE visual_config IS NOT NULL;
      END IF;
    END $$;
    """)

    alter table(:doc_cover_pinned_items, prefix: @prefix) do
      remove_if_exists(:visual_config, :map)
    end
  end

  def down do
    alter table(:doc_cover_groups, prefix: @prefix) do
      add_if_not_exists(:layout, :string)
    end

    execute("""
    UPDATE #{@prefix}.doc_cover_groups
    SET layout = ui_config->>'layout'
    WHERE ui_config ? 'layout'
    """)

    alter table(:doc_cover_groups, prefix: @prefix) do
      remove_if_exists(:ui_config, :map)
    end

    alter table(:doc_cover_items, prefix: @prefix) do
      remove_if_exists(:ui_config, :map)
    end

    alter table(:doc_cover_pinned_items, prefix: @prefix) do
      add_if_not_exists(:visual_config, :map)
    end

    execute("""
    UPDATE #{@prefix}.doc_cover_pinned_items
    SET visual_config = ui_config
    WHERE ui_config IS NOT NULL
    """)

    alter table(:doc_cover_pinned_items, prefix: @prefix) do
      remove_if_exists(:ui_config, :map)
    end
  end
end
