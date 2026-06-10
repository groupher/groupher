defmodule GroupherServer.Repo.Migrations.CreateCoverTables do
  use Ecto.Migration

  @prefix "cms"
  @article_tables ~w(posts blogs docs changelogs)a

  def change do
    create table(:cover_backgrounds, prefix: @prefix) do
      add(:type, :string)
      add(:source, :string)
      add(:has_pattern, :boolean, default: true)
      add(:pattern_id, :string)
      add(:pattern_intensity, :integer, default: 50)
      add(:pattern_tone, :string)
      add(:has_texture, :boolean, default: false)
      add(:gradient, :map)
      add(:blur_intensity, :integer, default: 0)
      add(:has_shadow, :boolean, default: false)
      add(:brightness, :integer, default: 100)
      add(:saturation, :integer, default: 100)
      add(:texture, :map)

      timestamps()
    end

    create table(:cover_edit_infos, prefix: @prefix) do
      add(:canvas_width, :integer, null: false)
      add(:canvas_height, :integer, null: false)
      add(:ratio, :float, null: false)
      add(:version, :integer, default: 1, null: false)
      add(:light, :map, null: false)
      add(:dark, :map, null: false)

      timestamps()
    end

    for table <- @article_tables do
      alter table(table, prefix: @prefix) do
        add(:cover_url, :string)
        add(:cover_url_dark, :string)

        add(
          :cover_edit_info_id,
          references(:cover_edit_infos, prefix: @prefix, on_delete: :nilify_all)
        )
      end

      create(index(table, [:cover_edit_info_id], prefix: @prefix))
    end
  end
end
