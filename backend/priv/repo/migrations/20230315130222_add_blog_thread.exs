defmodule GroupherServer.Repo.Migrations.AddBlogThread do
  use Ecto.Migration

  def change do
    create table(:cms_blogs) do
      add(:title, :string)
      add(:desc, :text)
      add(:body, :text)
      add(:digest, :string)
      add(:author_id, references(:cms_authors, on_delete: :delete_all), null: false)
      add(:views, :integer, default: 0)

      add(:length, :integer)
      add(:origial_community_id, references(:communities, on_delete: :delete_all))
      add(:link, :string)
      add(:link_addr, :string)

      add(:meta, :map)
      # reaction
      add(:upvotes_count, :integer, default: 0)
      add(:collects_count, :integer, default: 0)

      # comments
      add(:comments_participants_count, :integer, default: 0)
      add(:comments_count, :integer, default: 0)
      add(:comments_participants, :map)

      add(:is_archived, :boolean, default: false)
      add(:active_at, :utc_datetime)

      add(:is_pinned, :boolean, default: false)
      add(:emotions, :map)
      add(:mark_delete, :boolean, default: false)
      add(:pending, :integer, default: 0)

      add(:archived_at, :utc_datetime)
      add(:original_community_id, references(:communities, on_delete: :delete_all))

      timestamps()
    end

    create(index(:cms_blogs, [:author_id]))
  end
end
