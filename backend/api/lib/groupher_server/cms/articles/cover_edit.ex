defmodule GroupherServer.CMS.Articles.CoverEdit do
  @moduledoc """
  Owns the author-only, version-selected Article cover editor read model.

      Article projection + viewer
        -> author admission
        -> WorkingCopy or Snapshot cover edit
        -> stable cover editor DTO
  """

  alias GroupherServer.{CMS, Accounts, Repo}

  alias Accounts.Model.User
  alias CMS.Articles.Store

  @doc "Returns the selected cover editor DTO only to the Article author."
  @spec read(map(), User.t() | nil) :: {:ok, map() | nil}
  def read(article, %User{id: user_id}) do
    with author_id when not is_nil(author_id) <- Map.get(article, :author_id),
         {:ok, %{user_id: ^user_id}} <- Store.author(author_id),
         %{} = edit <- load(article) do
      {:ok, present(edit)}
    else
      _ -> {:ok, nil}
    end
  end

  def read(_article, _viewer), do: {:ok, nil}

  defp load(%{cover_edit_working_copy_id: id}) when is_binary(id) do
    Repo.get(CMS.Model.CoverEditWorkingCopy, id)
  end

  defp load(%{snapshot_id: id}) when is_binary(id) do
    case Repo.get(CMS.Model.ArticleSnapshot, id) do
      %{cover_edit_snapshot_id: cover_id} when is_binary(cover_id) ->
        Repo.get(CMS.Model.CoverEditSnapshot, cover_id)

      _ ->
        nil
    end
  end

  defp load(_article), do: nil

  defp present(edit) do
    %{
      id: edit.id,
      canvas_width: edit.canvas_width,
      canvas_height: edit.canvas_height,
      version: edit.format_version,
      light: theme(edit.light),
      dark: theme(edit.dark)
    }
  end

  defp theme(data) when is_map(data) do
    Map.new([:background_id, :original_background_id, :images], fn key ->
      {key, Map.get(data, key) || Map.get(data, Atom.to_string(key))}
    end)
  end
end
