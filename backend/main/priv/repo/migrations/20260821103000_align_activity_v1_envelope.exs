defmodule GroupherServer.Repo.Migrations.AlignActivityV1Envelope do
  use Ecto.Migration

  @prefix "activity"
  @tables ~w(post_logs blog_logs changelog_logs doc_logs community_logs doc_tree_logs press_logs)a

  def up do
    Enum.each(@tables, fn table_name ->
      rename(table(table_name, prefix: @prefix), :changes, to: :payload)
      rename(table(table_name, prefix: @prefix), :causation_ref, to: :parent_event_ref)

      alter table(table_name, prefix: @prefix) do
        remove(:correlation_ref, :uuid)
      end
    end)
  end

  def down do
    Enum.each(@tables, fn table_name ->
      alter table(table_name, prefix: @prefix) do
        add(:correlation_ref, :uuid)
      end

      rename(table(table_name, prefix: @prefix), :parent_event_ref, to: :causation_ref)
      rename(table(table_name, prefix: @prefix), :payload, to: :changes)
    end)
  end
end
