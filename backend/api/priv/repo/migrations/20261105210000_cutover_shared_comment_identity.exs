defmodule GroupherServer.Repo.Migrations.CutoverSharedCommentIdentity do
  @moduledoc "Cuts a fresh schema over to stable Article discussion identity."
  use Ecto.Migration

  def up do
    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM cms.articles) OR EXISTS (SELECT 1 FROM cms.comments) THEN
        RAISE EXCEPTION 'Shared discussion identity requires a fresh Article dataset';
      END IF;
    END $$;
    """)

    alter table(:comments, prefix: "cms") do
      remove(:branch_id)
      remove(:replies)
    end

    alter table(:pinned_comments, prefix: "cms") do
      remove(:branch_id)
    end

    create(
      unique_index(:pinned_comments, [:article_id, :comment_id],
        prefix: "cms",
        name: :pinned_comments_stable_article_target_index
      )
    )

    alter table(:doc_branch_states, prefix: "cms") do
      remove(:comments_locked)
      remove(:next_floor)
      remove(:next_comment_inner_id)
    end
  end

  def down do
    raise "Shared discussion cutover has no historical compatibility migration"
  end
end
