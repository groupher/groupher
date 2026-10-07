defmodule GroupherServer.Repo.Migrations.MoveKanbanStateToArticleCommunity do
  use Ecto.Migration

  @prefix "cms"

  def up do
    alter table(:post_states, prefix: @prefix) do
      remove(:status)
    end

    create table(:kanban_states, primary_key: false, prefix: @prefix) do
      add(
        :article_community_id,
        references(:article_communities, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:status, :string, null: false)
      add(:rank, :bigint)
      timestamps()
    end

    create(
      constraint(:kanban_states, :kanban_states_status_check,
        prefix: @prefix,
        check:
          "status IN ('default', 'backlog', 'todo', 'wip', 'done', 'resolved', 'reject', 'reject_dup', 'reject_no_plan', 'reject_repro', 'reject_stale')"
      )
    )
  end

  def down do
    drop(constraint(:kanban_states, :kanban_states_status_check, prefix: @prefix))
    drop(table(:kanban_states, prefix: @prefix))

    alter table(:post_states, prefix: @prefix) do
      add(:status, :string)
    end
  end
end
