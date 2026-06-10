defmodule GroupherServer.CMS.Covers do
  @moduledoc """
  Cover persistence helpers.
  """

  alias GroupherServer.CMS
  alias CMS.Model.{CoverBackground, CoverEditInfo}
  alias Helper.{ORM, T}

  @type article :: map()

  @doc """
  Persist cover data as part of an article create/update flow.

  Cover has no standalone create mutation. The browser renders and uploads the
  static image first, then submits the resulting `cover_url` together with the
  editable `cover_edit_info` payload while creating or updating an article.

  Omitted cover fields leave the current article cover unchanged. Passing
  `cover_edit_info: nil` removes the current cover. Passing a cover URL without
  edit info, or edit info without the primary cover URL, is rejected so the
  rendered artifact and editable source do not drift apart.

  ## Examples

      upsert_article_cover(article, %{})
      #=> {:ok, article}

      upsert_article_cover(article, %{
        cover_url: "https://cdn.example/cover.png",
        cover_url_dark: "https://cdn.example/cover-dark.png",
        cover_edit_info: %{light: light_config, dark: dark_config}
      })
      #=> {:ok, article_with_cover}

      upsert_article_cover(article, %{cover_edit_info: nil})
      #=> {:ok, article_without_cover}

  """
  @spec upsert_article_cover(article(), map()) :: T.domain_res(article())
  def upsert_article_cover(article, attrs) do
    with :ok <- validate_cover_pair(attrs) do
      cond do
        not Map.has_key?(attrs, :cover_edit_info) ->
          {:ok, article}

        is_nil(Map.get(attrs, :cover_edit_info)) ->
          remove_article_cover(article)

        true ->
          do_upsert_article_cover(article, attrs)
      end
    end
  end

  @spec remove_article_cover(article()) :: T.domain_res(article())
  def remove_article_cover(article) do
    old_cover_edit_info_id = Map.get(article, :cover_edit_info_id)

    with {:ok, article} <-
           update_article_cover_fields(article, %{
             cover_url: nil,
             cover_url_dark: nil,
             cover_edit_info_id: nil
           }),
         {:ok, _} <- delete_cover_edit_info(old_cover_edit_info_id) do
      {:ok, article}
    end
  end

  @spec delete_cover_edit_info(nil | T.id()) :: {:ok, :pass | CoverEditInfo.t()}
  def delete_cover_edit_info(nil), do: {:ok, :pass}

  def delete_cover_edit_info(id) do
    case ORM.find(CoverEditInfo, id) do
      {:ok, info} -> ORM.delete(info)
      {:error, _} -> {:ok, :pass}
    end
  end

  defp do_upsert_article_cover(article, attrs) do
    old_cover_edit_info_id = Map.get(article, :cover_edit_info_id)

    with {:ok, cover_attrs} <- prepare_cover_edit_info(Map.get(attrs, :cover_edit_info)),
         {:ok, cover_edit_info} <-
           create_or_update_cover_edit_info(old_cover_edit_info_id, cover_attrs),
         {:ok, article} <-
           update_article_cover_fields(article, %{
             cover_url: Map.get(attrs, :cover_url),
             cover_url_dark: Map.get(attrs, :cover_url_dark),
             cover_edit_info_id: cover_edit_info.id
           }) do
      {:ok, article}
    end
  end

  defp create_or_update_cover_edit_info(nil, attrs), do: ORM.create(CoverEditInfo, attrs)

  defp create_or_update_cover_edit_info(id, attrs) do
    case ORM.find(CoverEditInfo, id) do
      {:ok, info} -> ORM.update(info, attrs)
      {:error, _} -> ORM.create(CoverEditInfo, attrs)
    end
  end

  defp validate_cover_pair(attrs) do
    cover_edit_info = Map.get(attrs, :cover_edit_info)
    cover_url = Map.get(attrs, :cover_url)
    cover_url_dark = Map.get(attrs, :cover_url_dark)

    cond do
      not Map.has_key?(attrs, :cover_edit_info) and
          (present?(cover_url) or present?(cover_url_dark)) ->
        {:error, {:changeset, "cover url requires cover_edit_info"}}

      not is_nil(cover_edit_info) and not present?(cover_url) ->
        {:error, {:changeset, "cover_edit_info requires cover_url"}}

      is_nil(cover_edit_info) and (present?(cover_url) or present?(cover_url_dark)) ->
        {:error, {:changeset, "cover url requires cover_edit_info"}}

      true ->
        :ok
    end
  end

  defp prepare_cover_edit_info(attrs) when is_map(attrs) do
    with {:ok, light} <- prepare_cover_config(Map.get(attrs, :light)),
         {:ok, dark} <- prepare_cover_config(Map.get(attrs, :dark)) do
      {:ok, attrs |> Map.put(:light, light) |> Map.put(:dark, dark)}
    end
  end

  defp prepare_cover_edit_info(_), do: {:error, {:changeset, "cover_edit_info is invalid"}}

  defp prepare_cover_config(config) when is_map(config) do
    with {:ok, background_id} <- resolve_background_id(config),
         {:ok, original_background_id} <- resolve_original_background_id(config) do
      config =
        config
        |> Map.drop([:background, :original_background])
        |> Map.put(:background_id, background_id)
        |> put_optional(:original_background_id, original_background_id)

      {:ok, config}
    end
  end

  defp prepare_cover_config(_), do: {:error, {:changeset, "cover config is invalid"}}

  defp resolve_background_id(%{background_id: id}) when not is_nil(id), do: {:ok, id}

  defp resolve_background_id(%{background: background}) when is_map(background) do
    with {:ok, background} <- ORM.create(CoverBackground, background) do
      {:ok, background.id}
    end
  end

  defp resolve_background_id(_), do: {:error, {:changeset, "background is required"}}

  defp resolve_original_background_id(%{original_background_id: id}) when not is_nil(id),
    do: {:ok, id}

  defp resolve_original_background_id(%{original_background: background})
       when is_map(background) do
    with {:ok, background} <- ORM.create(CoverBackground, background) do
      {:ok, background.id}
    end
  end

  defp resolve_original_background_id(_), do: {:ok, nil}

  defp put_optional(map, _key, nil), do: map
  defp put_optional(map, key, value), do: Map.put(map, key, value)

  defp update_article_cover_fields(article, attrs), do: ORM.update(article, attrs, strict: false)

  defp present?(value) when value in [nil, ""], do: false
  defp present?(_), do: true
end
