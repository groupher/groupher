defmodule GroupherServer.CMS.Articles.VersionedRelations do
  @moduledoc """
  Owns versioned Article relations that can not be copied as scalar ids.

      source Article
          |
          +--> community_tags ------ copy association ------+
          |                                                 |
          +--> CoverEditInfo ------ clone mutable row -------+--> target Draft/public

  Draft and Preview rows never share mutable Cover edit state with main/public.
  Snapshot data stores tag ids and the complete Cover editor value. Runtime
  relations such as comments, reactions, and collects never enter this module.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, CommunityTag, CoverEditInfo}
  alias Helper.{ORM, T}

  @doc "Returns relation state suitable for immutable DocSnapshot data."
  @spec snapshot_data(T.article()) :: map()
  def snapshot_data(article) do
    article = Repo.preload(article, :community_tags, force: true)

    %{
      community_tag_ids: Enum.map(article.community_tags, & &1.id),
      cover: cover_data(article)
    }
  end

  @doc "Copies Tags and clones Cover state into a Draft or public row without runtime stats."
  @spec copy_to_draft(T.article(), T.article()) :: {:ok, T.article()} | {:error, term()}
  def copy_to_draft(source, target) do
    with {:ok, target} <- put_tags(target, tag_ids(source)),
         {:ok, target} <- replace_cover(target, cover_data(source)),
         {:ok, target} <-
           ORM.update(
             target,
             %{
               cover_url: source.cover_url,
               cover_url_dark: source.cover_url_dark
             },
             strict: false
           ) do
      {:ok, target}
    end
  end

  @doc "Applies explicitly supplied versioned relations to a newly-created Draft."
  @spec apply_input(T.article(), map()) :: {:ok, T.article()} | {:error, term()}
  def apply_input(article, attrs) do
    with {:ok, article} <- apply_cover_input(article, attrs) do
      case option(attrs, :community_tag_ids) || option(attrs, :community_tags) do
        nil -> {:ok, article}
        tag_ids when is_list(tag_ids) -> put_tags(article, tag_ids)
        _ -> {:error, {:custom, "Article community tags are invalid"}}
      end
    end
  end

  @doc "Replaces public versioned relations while preserving unrelated runtime relations."
  @spec publish(Community.t(), atom(), T.article(), T.article()) ::
          {:ok, T.article()} | {:error, term()}
  def publish(%Community{} = community, thread, draft, public_article) do
    with {:ok, public_article} <-
           CMS.Communities.overwrite_tags(community, thread, public_article, %{
             community_tags: tag_ids(draft)
           }),
         {:ok, public_article} <- replace_cover(public_article, cover_data(draft)) do
      ORM.update(
        public_article,
        %{
          cover_url: draft.cover_url,
          cover_url_dark: draft.cover_url_dark
        },
        strict: false
      )
    end
  end

  @doc "Restores Snapshot relation data into a target Draft."
  @spec restore(T.article(), map()) :: {:ok, T.article()} | {:error, term()}
  def restore(article, data) when is_map(data) do
    with {:ok, article} <- put_tags(article, data_value(data, :community_tag_ids, [])),
         {:ok, article} <- replace_cover(article, data_value(data, :cover)),
         {:ok, article} <-
           ORM.update(
             article,
             %{
               cover_url: data_value(data, :cover_url),
               cover_url_dark: data_value(data, :cover_url_dark)
             },
             strict: false
           ) do
      {:ok, article}
    end
  end

  @doc "Deletes Cover edit state still owned by a Draft that has been consumed."
  @spec delete_owned_cover(T.article()) :: {:ok, term()}
  def delete_owned_cover(article) do
    CMS.Covers.delete_cover_edit_info(article.cover_edit_info_id)
  end

  @doc "Activates tag statistics when the first Draft row becomes main/public."
  @spec activate_first_publish(T.article()) :: {:ok, :pass} | {:error, term()}
  def activate_first_publish(article) do
    article
    |> Repo.preload(:community_tags, force: true)
    |> Map.fetch!(:community_tags)
    |> Enum.reduce_while({:ok, :pass}, fn tag, {:ok, :pass} ->
      case CMS.Communities.TagStats.inc(article, tag) do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        error -> {:halt, error}
      end
    end)
  end

  defp tag_ids(article) do
    article
    |> Repo.preload(:community_tags, force: true)
    |> Map.fetch!(:community_tags)
    |> Enum.map(& &1.id)
    |> Enum.sort()
  end

  defp put_tags(article, ids) do
    ids = Enum.map(ids, &normalize_id/1)

    with {:ok, thread} <- CMS.FrontDesk.thread_of(article) do
      tags =
        CommunityTag
        |> where([tag], tag.id in ^ids)
        |> where([tag], tag.community_id == ^article.community_id)
        |> where([tag], tag.thread == ^thread)
        |> Repo.all()

      if Enum.sort(Enum.map(tags, & &1.id)) == Enum.sort(Enum.uniq(ids)) do
        article
        |> Repo.preload(:community_tags, force: true)
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(:community_tags, tags)
        |> Repo.update()
      else
        {:error, {:custom, "Article community tags do not belong to its Community and thread"}}
      end
    end
  end

  defp apply_cover_input(article, attrs) do
    cond do
      has_option?(attrs, :cover_edit_info) ->
        CMS.Covers.upsert_article_cover(article, attrs)

      has_option?(attrs, :cover_url) or has_option?(attrs, :cover_url_dark) ->
        {:error, {:custom, "Article cover URLs require editable Cover state"}}

      true ->
        {:ok, article}
    end
  end

  defp replace_cover(article, cover_data) do
    old_cover_id = article.cover_edit_info_id

    with {:ok, new_cover_id} <- create_cover(cover_data),
         {:ok, article} <-
           ORM.update(article, %{cover_edit_info_id: new_cover_id}, strict: false),
         {:ok, _deleted} <- delete_replaced_cover(old_cover_id, new_cover_id) do
      {:ok, article}
    end
  end

  defp create_cover(nil), do: {:ok, nil}

  defp create_cover(attrs) when is_map(attrs) do
    with {:ok, cover} <- ORM.create(CoverEditInfo, attrs), do: {:ok, cover.id}
  end

  defp delete_replaced_cover(nil, _new_cover_id), do: {:ok, :pass}
  defp delete_replaced_cover(id, id), do: {:ok, :pass}
  defp delete_replaced_cover(id, _new_cover_id), do: CMS.Covers.delete_cover_edit_info(id)

  defp cover_data(%{cover_edit_info_id: nil}), do: nil

  defp cover_data(%{cover_edit_info_id: id}) do
    case ORM.find(CoverEditInfo, id) do
      {:ok, cover} ->
        %{
          canvas_width: cover.canvas_width,
          canvas_height: cover.canvas_height,
          version: cover.version,
          light: embed_data(cover.light),
          dark: embed_data(cover.dark)
        }

      {:error, _} ->
        nil
    end
  end

  defp embed_data(nil), do: nil

  defp embed_data(embed) do
    embed
    |> Map.from_struct()
    |> Map.drop([:__meta__])
  end

  defp normalize_id(id) when is_integer(id), do: id
  defp normalize_id(id) when is_binary(id), do: String.to_integer(id)

  defp data_value(data, key, default \\ nil) do
    Map.get(data, key, Map.get(data, Atom.to_string(key), default))
  end

  defp option(attrs, key), do: Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))

  defp has_option?(attrs, key) do
    Map.has_key?(attrs, key) or Map.has_key?(attrs, Atom.to_string(key))
  end
end
