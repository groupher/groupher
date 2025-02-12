defmodule GroupherServer.Repo.Migrations.RenameBodyFieldInArticle do
  use Ecto.Migration

  def change do
    alter table(:cms_posts), do: remove(:body)
    alter table(:cms_changelogs), do: remove(:body)
    alter table(:cms_blogs), do: remove(:body)
    alter table(:cms_docs), do: remove(:body)
  end
end
