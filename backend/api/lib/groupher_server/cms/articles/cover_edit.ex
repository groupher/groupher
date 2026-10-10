defmodule GroupherServer.CMS.Articles.CoverEdit do
  @moduledoc """
  Owns the author-only, version-selected Article cover editor read model.

      Article projection + viewer
        -> author admission
        -> Draft or Revision cover edit
        -> stable cover editor DTO
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Articles.Store

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

  defp load(%{body_draft_id: body_draft_id}) when is_binary(body_draft_id) do
    value(Store.draft_cover_edit(body_draft_id))
  end

  defp load(%{revision_id: revision_id}) when is_binary(revision_id) do
    value(Store.revision_cover_edit(revision_id))
  end

  defp load(_article), do: nil

  defp value({:ok, value}), do: value
  defp value({:error, _reason}), do: nil

  defp present(edit) do
    edit
    |> Map.from_struct()
    |> Map.put(:id, Map.get(edit, :body_draft_id) || Map.get(edit, :revision_id))
    |> Map.put(:light, %{
      background_id: edit.light_background_id,
      original_background_id: edit.light_original_background_id,
      images: edit.light_images
    })
    |> Map.put(:dark, %{
      background_id: edit.dark_background_id,
      original_background_id: edit.dark_original_background_id,
      images: edit.dark_images
    })
  end
end
