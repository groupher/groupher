defmodule GroupherServer.Repo.Migrations.IndexReferenceMapEdgeWindows do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create_if_not_exists(
      index(
        :artiment_mentions,
        [:mentioner_type, :mentioner_article_id, :mentioner_branch_id, :edge_key],
        prefix: @prefix,
        where: "mentioner_article_id IS NOT NULL",
        name: :mentions_article_outgoing_edge_index
      )
    )

    create_if_not_exists(
      index(:artiment_mentions, [:mentioner_comment_id, :edge_key],
        prefix: @prefix,
        where: "mentioner_comment_id IS NOT NULL",
        name: :mentions_comment_outgoing_edge_index
      )
    )

    create_if_not_exists(
      index(
        :artiment_mentions,
        [:mentioned_type, :mentioned_article_id, :mentioned_branch_id, :edge_key],
        prefix: @prefix,
        where: "mentioned_scope = 'internal' AND mentioned_article_id IS NOT NULL",
        name: :mentions_article_incoming_edge_index
      )
    )

    create_if_not_exists(
      index(:artiment_mentions, [:mentioned_comment_id, :edge_key],
        prefix: @prefix,
        where: "mentioned_scope = 'internal' AND mentioned_comment_id IS NOT NULL",
        name: :mentions_comment_incoming_edge_index
      )
    )

    create_if_not_exists(
      index(:artiment_mentions, [:mentioned_user_id, :edge_key],
        prefix: @prefix,
        where: "mentioned_scope = 'internal' AND mentioned_user_id IS NOT NULL",
        name: :mentions_user_incoming_edge_index
      )
    )
  end
end
