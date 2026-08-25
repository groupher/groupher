defmodule GroupherServer.Repo.Migrations.AddDocTreeEventSelectors do
  use Ecto.Migration

  @prefix "cms"

  def up do
    alter table(:doc_tree_events, prefix: @prefix) do
      add_if_not_exists(:node_id, :string)
      add_if_not_exists(:node_type, :string)
    end

    flush()

    execute("""
    UPDATE #{@prefix}.doc_tree_events
    SET
      node_id = COALESCE(
        node_id,
        NULLIF(COALESCE(payload ->> 'nodeId', payload -> 'node' ->> 'id'), '')
      ),
      node_type = COALESCE(
        node_type,
        NULLIF(COALESCE(payload ->> 'nodeType', payload -> 'node' ->> 'type'), '')
      ),
      doc_id = COALESCE(
        doc_id,
        CASE
          WHEN COALESCE(payload ->> 'docId', payload -> 'node' ->> 'docId') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN COALESCE(payload ->> 'docId', payload -> 'node' ->> 'docId')::uuid
          ELSE NULL
        END
      )
    WHERE payload IS NOT NULL;
    """)

    create_if_not_exists(
      index(:doc_tree_events, [:community_id, :status, :owner, :doc_id],
        prefix: @prefix,
        name: :doc_tree_events_selector_doc_index
      )
    )

    create_if_not_exists(
      index(:doc_tree_events, [:community_id, :status, :owner, :event_type, :node_id],
        prefix: @prefix,
        name: :doc_tree_events_selector_node_index
      )
    )
  end

  def down do
    drop_if_exists(
      index(:doc_tree_events, [:community_id, :status, :owner, :event_type, :node_id],
        prefix: @prefix,
        name: :doc_tree_events_selector_node_index
      )
    )

    drop_if_exists(
      index(:doc_tree_events, [:community_id, :status, :owner, :doc_id],
        prefix: @prefix,
        name: :doc_tree_events_selector_doc_index
      )
    )

    alter table(:doc_tree_events, prefix: @prefix) do
      remove_if_exists(:node_type, :string)
      remove_if_exists(:node_id, :string)
    end
  end
end
