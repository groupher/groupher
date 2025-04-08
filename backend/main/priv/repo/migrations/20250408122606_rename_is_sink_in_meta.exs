defmodule GroupherServer.Repo.Migrations.RenameIsSinkInMeta do
  use Ecto.Migration

  use Ecto.Migration
  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{Post, Changelog, Blog, Doc, Embeds}

  @models_using_meta [Post, Changelog, Blog, Doc]

  def up do
    Enum.each(@models_using_meta, fn model ->
      query = from(r in model, where: not is_nil(r.meta))

      Repo.transaction(fn ->
        Repo.stream(query)
        |> Enum.each(fn record ->
          meta = record.meta || %{}

          updated_meta =
            if Map.has_key?(meta, :is_sinked) do
              meta
              |> Map.put(:is_sunk, meta.is_sinked)
              |> Map.delete(:is_sinked)
            else
              meta
            end

          if updated_meta != meta do
            record
            |> Ecto.Changeset.change()
            |> Ecto.Changeset.put_embed(:meta, updated_meta)
            |> Repo.update!()
          end
        end)
      end)
    end)
  end

  def down do
    Enum.each(@models_using_meta, fn model ->
      query = from(r in model, where: not is_nil(r.meta))

      Repo.transaction(fn ->
        Repo.stream(query)
        |> Enum.each(fn record ->
          meta = record.meta || %{}

          updated_meta =
            if Map.has_key?(meta, :is_sunk) do
              meta
              |> Map.put(:is_sinked, meta.is_sunk)
              |> Map.delete(:is_sunk)
            else
              meta
            end

          if updated_meta != meta do
            record
            |> Ecto.Changeset.change()
            |> Ecto.Changeset.put_embed(:meta, updated_meta)
            |> Repo.update!()
          end
        end)
      end)
    end)
  end
end
