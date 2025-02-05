defmodule GroupherServer.Repo.Migrations.AddDocRefs do
  use Ecto.Migration

  def change do
    create table(:communities_join_docs) do
      add(:community_id, references(:communities, on_delete: :delete_all), null: false)
      add(:doc_id, references(:cms_docs, on_delete: :delete_all), null: false)
    end

    create(unique_index(:communities_join_docs, [:community_id, :doc_id]))

    alter table(:articles_join_tags) do
      add(:doc_id, references(:cms_docs, on_delete: :delete_all))
    end

    alter table(:abuse_reports) do
      add(:doc_id, references(:cms_docs, on_delete: :delete_all))
    end

    alter table(:article_collects) do
      add(:doc_id, references(:cms_docs, on_delete: :delete_all))
    end

    alter table(:article_upvotes) do
      add(:doc_id, references(:cms_docs, on_delete: :delete_all))
    end

    alter table(:comments) do
      add(:doc_id, references(:cms_docs, on_delete: :delete_all))
    end

    alter table(:pinned_comments) do
      add(:doc_id, references(:cms_docs, on_delete: :delete_all))
    end

    alter table(:articles_users_emotions) do
      add(:doc_id, references(:cms_docs, on_delete: :delete_all))
    end

    alter table(:pinned_articles) do
      add(:doc_id, references(:cms_docs, on_delete: :delete_all))
    end

    alter table(:cited_artiments) do
      add(:doc_id, references(:cms_docs, on_delete: :delete_all))
    end

    create(unique_index(:article_upvotes, [:user_id, :doc_id]))
  end
end
