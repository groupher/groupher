defmodule GroupherServer.Repo.Migrations.RenameRawToSlug2 do
  use Ecto.Migration

  def change do
    rename(table(:cms_posts), :original_community_raw, to: :original_community_slug)
    rename(table(:cms_blogs), :original_community_raw, to: :original_community_slug)
    rename(table(:cms_changelogs), :original_community_raw, to: :original_community_slug)
    rename(table(:cms_docs), :original_community_raw, to: :original_community_slug)
  end
end
