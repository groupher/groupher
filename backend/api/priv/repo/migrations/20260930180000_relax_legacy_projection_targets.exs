defmodule GroupherServer.Repo.Migrations.RelaxLegacyProjectionTargets do
  use Ecto.Migration

  @moduledoc "Allows typed interaction projections to target the stable Article UUID."

  @prefix "cms"
  @targets [
    {:post_reaction_infos, :post_id},
    {:blog_reaction_infos, :blog_id},
    {:changelog_reaction_infos, :changelog_id},
    {:doc_reaction_infos, :doc_id},
    {:post_emotion_infos, :post_id},
    {:blog_emotion_infos, :blog_id},
    {:changelog_emotion_infos, :changelog_id},
    {:doc_emotion_infos, :doc_id}
  ]

  def up do
    Enum.each(@targets, fn {table, target} ->
      alter table(table, prefix: @prefix) do
        modify(target, :bigint, null: true)
      end
    end)
  end

  def down do
    Enum.each(Enum.reverse(@targets), fn {table, target} ->
      alter table(table, prefix: @prefix) do
        modify(target, :bigint, null: false)
      end
    end)
  end
end
