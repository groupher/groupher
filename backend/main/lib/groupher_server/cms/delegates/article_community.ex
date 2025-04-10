defmodule GroupherServer.CMS.Delegate.ArticleCommunity do
  @moduledoc """
  set / unset operations for Article-like resource
  """
  import GroupherServer.CMS.Helper.Matcher
  import Ecto.Query, warn: false

  import Helper.ErrorCode
  import Helper.Utils, only: [done: 1, thread_of: 1]
  import GroupherServer.CMS.Helper.Matcher

  alias Helper.ORM

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Embeds, Community, PinnedArticle}
  alias CMS.Delegate.ArticleTag

  alias Ecto.Multi

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  def pin_article(%Community{} = community, article) do
    with {:ok, thread} <- thread_of(article),
         args <- pack_pin_args(community, thread, article.id),
         {:ok, _} <- check_pinned_article_count(community, thread),
         {:ok, _} <- ORM.create(PinnedArticle, args) do
      {:ok, article}
    end
  end

  def undo_pin_article(%Community{} = community, article) do
    with {:ok, thread} <- thread_of(article),
         args <- pack_pin_args(community, thread, article.id),
         {:ok, _} <- ORM.findby_delete(PinnedArticle, args) do
      {:ok, article}
    end
  end

  defp pack_pin_args(%Community{} = community, thread, article_id) do
    with {:ok, info} <- match(thread) do
      thread = thread |> to_string |> String.upcase()

      Map.put(
        %{community_id: community.id, thread: thread},
        info.foreign_key,
        article_id
      )
    end
  end

  ########
  ########
  ########

  @doc """
  mirror article to other community
  """
  def mirror_article(%Community{} = target_community, article, article_tag_ids \\ []) do
    article = Repo.preload(article, :communities)

    with {:ok, thread} <- thread_of(article) do
      Multi.new()
      |> Multi.run(:mirror_target_community, fn _, _ ->
        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(:communities, article.communities ++ [target_community])
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{mirror_target_community: article} ->
        ArticleTag.set_article_tags(target_community, thread, article, %{
          article_tags: article_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc """
  unmirror article to a community
  """
  def unmirror_article(%Community{} = target_community, article) do
    article = Repo.preload(article, [:communities, :community, :article_tags])

    case article.community.id == target_community.id do
      true ->
        raise_error(:mirror_article, "can not unmirror original community")

      false ->
        article_tags = tags_without_community(article, target_community)

        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(
          :communities,
          Enum.reject(article.communities, &(&1.slug == target_community.slug))
        )
        |> Ecto.Changeset.put_assoc(:article_tags, article_tags)
        |> Repo.update()
    end
  end

  @doc """
  move article original community to other community
  """
  def move_article(%Community{} = target_community, article, article_tag_ids \\ []) do
    article = Repo.preload(article, [:communities, :community, :article_tags])

    with {:ok, thread} <- thread_of(article) do
      original_community = article.community

      Multi.new()
      |> Multi.run(:move_article, fn _, _ ->
        communities = (article.communities -- [original_community]) ++ [target_community]
        article_tags = tags_without_community(article, original_community)

        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_change(:community_id, target_community.id)
        |> Ecto.Changeset.put_assoc(:communities, communities)
        |> Ecto.Changeset.put_assoc(:article_tags, article_tags)
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{move_article: article} ->
        ArticleTag.set_article_tags(target_community, thread, article, %{
          article_tags: article_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc """
  shortcut for mirror article to home page
  """
  def mirror_to_home(%Community{} = home_community, article, article_tag_ids \\ []) do
    article = Repo.preload(article, [:communities, :article_tags])

    with {:ok, thread} <- thread_of(article) do
      Multi.new()
      |> Multi.run(:set_community, fn _, _ ->
        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(:communities, article.communities ++ [home_community])
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{set_community: article} ->
        ArticleTag.set_article_tags(home_community, thread, article, %{
          article_tags: article_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  def mirror_to_home2(thread, article_id, article_tag_ids \\ []) do
    preload = [:communities, :article_tags]

    with {:ok, info} <- match(thread),
         {:ok, community} <- ORM.find_by(Community, %{slug: "home"}),
         {:ok, article} <- ORM.find(info.model, article_id, preload: preload) do
      Multi.new()
      |> Multi.run(:set_community, fn _, _ ->
        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(:communities, article.communities ++ [community])
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{set_community: article} ->
        ArticleTag.set_article_tags(community, thread, article, %{article_tags: article_tag_ids})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc """
  shortcut for move article to blackhole
  """
  def move_to_blackhole(%Community{} = blackhole, article, article_tag_ids \\ []) do
    article = Repo.preload(article, [:communities, :community, :article_tags])

    with {:ok, thread} <- thread_of(article) do
      Multi.new()
      |> Multi.run(:set_community, fn _, _ ->
        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_change(:community_id, blackhole.id)
        |> Ecto.Changeset.put_assoc(:communities, [blackhole])
        |> Ecto.Changeset.put_assoc(:article_tags, [])
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{set_community: article} ->
        ArticleTag.set_article_tags(blackhole, thread, article, %{
          article_tags: article_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc "update isEdited meta label if needed"
  # TODO: diff history
  def update_edit_status(%{meta: %Embeds.ArticleMeta{is_edited: _} = meta} = content) do
    meta = meta |> Map.merge(%{is_edited: true})
    ORM.update_meta(content, meta)
  end

  # for test or existing articles
  def update_edit_status(%{meta: nil} = content) do
    meta = Embeds.ArticleMeta.default_meta() |> Map.merge(%{is_edited: true})

    ORM.update_meta(content, meta)
  end

  def update_edit_status(content, _), do: {:ok, content}

  # check if the thread has already enough pinned articles
  defp check_pinned_article_count(%Community{} = community, thread) do
    thread = thread |> to_string |> String.upcase()

    query =
      from(p in PinnedArticle, where: p.community_id == ^community.id and p.thread == ^thread)

    pinned_articles = query |> Repo.all()

    case length(pinned_articles) >= @max_pinned_article_count_per_thread do
      true -> raise_error(:too_much_pinned_article, "too much pinned article")
      _ -> {:ok, :pass}
    end
  end

  defp tags_without_community(article, %Community{id: community_id}) do
    %{article_tags: article_tags} = article
    article_tags -- Enum.filter(article_tags, &(&1.community_id === community_id))
  end

  defp result({:ok, %{set_target_tags: result}}), do: result |> done()
  defp result({:ok, %{mirror_target_community: result}}), do: result |> done()

  defp result({:error, _, result, _steps}), do: {:error, result}
end
