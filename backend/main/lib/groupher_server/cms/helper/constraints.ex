defmodule GroupherServer.CMS.Helper.Constraints do
  @moduledoc """
  Ecto constraint helpers for CMS models.
  This module has no dependencies on other CMS modules to avoid circular dependencies.
  """
  import Ecto.Changeset

  @threads Application.compile_env(:groupher_server, :article, [])
                   |> Keyword.get(:threads, [])
  @article_fields @threads |> Enum.map(&:"#{&1}_id")

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

  @spec articles_exactly_one_ref_constraint(Ecto.Changeset.t(), atom()) :: Ecto.Changeset.t()
  def articles_exactly_one_ref_constraint(%Ecto.Changeset{} = changeset, table_name) do
    check_constraint(changeset, List.first(@article_fields) || :id,
      name: :"#{table_name}_exactly_one_article_ref_check"
    )
  end

  @spec articles_at_most_one_ref_constraint(Ecto.Changeset.t(), atom()) :: Ecto.Changeset.t()
  def articles_at_most_one_ref_constraint(%Ecto.Changeset{} = changeset, table_name) do
    check_constraint(changeset, List.first(@article_fields) || :id,
      name: :"#{table_name}_at_most_one_article_ref_check"
    )
  end

  @spec articles_thread_matches_ref_constraint(Ecto.Changeset.t(), atom()) :: Ecto.Changeset.t()
  def articles_thread_matches_ref_constraint(%Ecto.Changeset{} = changeset, table_name) do
    check_constraint(changeset, :thread, name: :"#{table_name}_thread_matches_article_ref_check")
  end

  @spec articles_upvote_unique_key_constraint(Ecto.Changeset.t()) :: Ecto.Changeset.t()
  def articles_upvote_unique_key_constraint(%Ecto.Changeset{} = changeset) do
    Enum.reduce(@article_fields, changeset, fn thread_id, acc ->
      unique_constraint(acc, thread_id, name: :"article_upvotes_user_id_#{thread_id}_index")
    end)
  end

  @spec articles_emotion_unique_key_constraint(Ecto.Changeset.t()) :: Ecto.Changeset.t()
  def articles_emotion_unique_key_constraint(%Ecto.Changeset{} = changeset) do
    Enum.reduce(@article_fields, changeset, fn thread_id, acc ->
      unique_constraint(acc, thread_id,
        name: :"article_user_emotions_user_id_#{thread_id}_emotion_index"
      )
    end)
  end

  @spec comment_emotion_unique_key_constraint(Ecto.Changeset.t()) :: Ecto.Changeset.t()
  def comment_emotion_unique_key_constraint(%Ecto.Changeset{} = changeset) do
    unique_constraint(changeset, :emotion,
      name: :comments_users_emotions_comment_id_user_id_emotion_index
    )
  end
end
