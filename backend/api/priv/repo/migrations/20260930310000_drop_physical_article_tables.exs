defmodule GroupherServer.Repo.Migrations.DropPhysicalArticleTables do
  use Ecto.Migration

  @moduledoc """
  Removes the four physical Article authorities after stable cutover.

  Join and legacy document tables are dropped first so every foreign-key edge
  is explicit; this migration intentionally avoids `CASCADE`.
  """

  def up do
    for table <- ~w(
          communities_join_posts communities_join_blogs communities_join_changelogs
          communities_join_docs community_join_tags post_documents blog_documents
          changelog_documents doc_documents
        )a do
      drop(table(table, prefix: "cms"))
    end

    for table <- ~w(posts blogs changelogs docs cover_edit_infos)a do
      drop(table(table, prefix: "cms"))
    end
  end

  def down, do: execute("SELECT 1")
end
