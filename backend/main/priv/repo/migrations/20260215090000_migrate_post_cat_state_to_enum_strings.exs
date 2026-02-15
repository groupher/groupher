defmodule GroupherServer.Repo.Migrations.MigratePostCatStateToEnumStrings do
  use Ecto.Migration

  def up do
    execute("""
    ALTER TABLE cms.posts
    ALTER COLUMN cat TYPE varchar
    USING (
      CASE cat::text
        WHEN '1' THEN 'feature'
        WHEN '2' THEN 'bug'
        WHEN '3' THEN 'question'
        WHEN '4' THEN 'other'
        WHEN 'feature' THEN 'feature'
        WHEN 'bug' THEN 'bug'
        WHEN 'question' THEN 'question'
        WHEN 'other' THEN 'other'
        ELSE NULL
      END
    )
    """)

    execute("""
    ALTER TABLE cms.posts
    ALTER COLUMN state TYPE varchar
    USING (
      CASE state::text
        WHEN '1' THEN 'default'
        WHEN '2' THEN 'todo'
        WHEN '3' THEN 'wip'
        WHEN '4' THEN 'done'
        WHEN '5' THEN 'resolved'
        WHEN '6' THEN 'reject'
        WHEN '7' THEN 'reject_dup'
        WHEN '8' THEN 'reject_no_plan'
        WHEN '9' THEN 'reject_repro'
        WHEN '10' THEN 'reject_stale'
        WHEN '11' THEN 'backlog'
        WHEN 'default' THEN 'default'
        WHEN 'todo' THEN 'todo'
        WHEN 'wip' THEN 'wip'
        WHEN 'done' THEN 'done'
        WHEN 'resolved' THEN 'resolved'
        WHEN 'reject' THEN 'reject'
        WHEN 'reject_dup' THEN 'reject_dup'
        WHEN 'reject_no_plan' THEN 'reject_no_plan'
        WHEN 'reject_repro' THEN 'reject_repro'
        WHEN 'reject_stale' THEN 'reject_stale'
        WHEN 'backlog' THEN 'backlog'
        ELSE NULL
      END
    )
    """)
  end

  def down do
    execute("""
    ALTER TABLE cms.posts
    ALTER COLUMN cat TYPE integer
    USING (
      CASE cat::text
        WHEN 'feature' THEN 1
        WHEN 'bug' THEN 2
        WHEN 'question' THEN 3
        WHEN 'other' THEN 4
        WHEN '1' THEN 1
        WHEN '2' THEN 2
        WHEN '3' THEN 3
        WHEN '4' THEN 4
        ELSE NULL
      END
    )
    """)

    execute("""
    ALTER TABLE cms.posts
    ALTER COLUMN state TYPE integer
    USING (
      CASE state::text
        WHEN 'default' THEN 1
        WHEN 'todo' THEN 2
        WHEN 'wip' THEN 3
        WHEN 'done' THEN 4
        WHEN 'resolved' THEN 5
        WHEN 'reject' THEN 6
        WHEN 'reject_dup' THEN 7
        WHEN 'reject_no_plan' THEN 8
        WHEN 'reject_repro' THEN 9
        WHEN 'reject_stale' THEN 10
        WHEN 'backlog' THEN 11
        WHEN '1' THEN 1
        WHEN '2' THEN 2
        WHEN '3' THEN 3
        WHEN '4' THEN 4
        WHEN '5' THEN 5
        WHEN '6' THEN 6
        WHEN '7' THEN 7
        WHEN '8' THEN 8
        WHEN '9' THEN 9
        WHEN '10' THEN 10
        WHEN '11' THEN 11
        ELSE NULL
      END
    )
    """)
  end
end
