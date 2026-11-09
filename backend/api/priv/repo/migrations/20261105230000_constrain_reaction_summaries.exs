defmodule GroupherServer.Repo.Migrations.ConstrainReactionSummaries do
  @moduledoc "Nonnegative reaction counters and bounded persisted display snapshots."
  use Ecto.Migration
  @article_threads ~w(post blog changelog doc)

  def up do
    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM cms.articles) OR EXISTS (SELECT 1 FROM cms.comments) THEN
        RAISE EXCEPTION 'Reaction summary contract requires a fresh Article dataset';
      END IF;
    END $$;
    """)

    for thread <- @article_threads ++ ["comment"] do
      table = String.to_atom("#{thread}_reaction_infos")

      collection =
        if thread == "comment" do
          ""
        else
          " AND collects_count >= 0 AND cardinality(latest_collected_users) <= 5"
        end

      create(
        constraint(table, :reaction_summary_check,
          prefix: "cms",
          check:
            "upvotes_count >= 0 AND reports_count >= 0 AND interaction_revision >= 0 AND cardinality(latest_upvoted_users) <= 5" <>
              collection
        )
      )

      emotions = String.to_atom("#{thread}_emotion_infos")

      create(
        constraint(emotions, :emotion_summary_check,
          prefix: "cms",
          check: "users_count >= 0 AND cardinality(latest_users) <= 5"
        )
      )
    end
  end

  def down do
    raise "Reaction summary contract has no historical compatibility rollback"
  end
end
