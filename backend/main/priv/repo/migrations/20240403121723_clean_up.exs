defmodule GroupherServer.Repo.Migrations.CleanUp do
  use Ecto.Migration

  def change do
    drop table(:education_backgrounds)
    drop table(:cms_blog_rss)
  end
end
