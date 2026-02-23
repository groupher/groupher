defmodule GroupherServer.CMS.Helper.Constraints do
  @moduledoc """
  Ecto constraint helpers for CMS models.
  This module has no dependencies on other CMS modules to avoid circular dependencies.
  """
  import Ecto.Changeset

  @article_threads Application.compile_env(:groupher_server, :article, []) |> Keyword.get(:threads, [])
  @article_fields @article_threads |> Enum.map(&:"#{&1}_id")

  @doc """
  foreign_key_constraint for articles thread

  e.g
  foreign_key_constraint(struct, :post_id)
  """
  @spec articles_foreign_key_constraint(Ecto.Changeset.t()) :: Ecto.Changeset.t()
  def articles_foreign_key_constraint(%Ecto.Changeset{} = changeset) do
    Enum.reduce(@article_fields, changeset, fn thread_id, acc ->
      foreign_key_constraint(acc, thread_id)
    end)
  end

  @spec articles_upvote_unique_key_constraint(Ecto.Changeset.t()) :: Ecto.Changeset.t()
  def articles_upvote_unique_key_constraint(%Ecto.Changeset{} = changeset) do
    Enum.reduce(@article_fields, changeset, fn thread_id, acc ->
      unique_constraint(acc, thread_id, name: :"article_upvotes_user_id_#{thread_id}_index")
    end)
  end
end
