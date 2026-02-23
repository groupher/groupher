defmodule GroupherServer.CMS.Articles.Placement do
  @moduledoc """
  Article placement helpers.
  """

  import GroupherServer.CMS.Helper.Matcher
  import Ecto.Query, warn: false
  import Helper.ErrorCode
  import Helper.Utils, only: [done: 1]
  import GroupherServer.CMS.FrontDesk, only: [thread_of: 1]

  alias Ecto.Multi
  alias Helper.ORM
  alias Helper.Types, as: T
  alias GroupherServer.Repo
  alias GroupherServer.CMS.Model.{Community, PinnedArticle}
  alias GroupherServer.CMS.Communities

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  @spec pin(Community.t(), T.article()) :: T.domain_res(T.article())
  def pin(%Community{} = community, article) do
    with {:ok, thread} <- thread_of(article),
         args <- pack_pin_args(community, thread, article.id),
         {:ok, _} <- check_pinned_article_count(community, thread),
         {:ok, _} <- ORM.create(PinnedArticle, args) do
      {:ok, article}
    end
  end

  @spec undo_pin(Community.t(), T.article()) :: T.domain_res(T.article())
  def undo_pin(%Community{} = community, article) do
    with {:ok, thread} <- thread_of(article),
         args <- pack_pin_args(community, thread, article.id),
         {:ok, _} <- ORM.findby_delete(PinnedArticle, args) do
      {:ok, article}
    end
  end

  @spec mirror(Community.t(), T.article()) :: T.domain_res(T.article())
  @spec mirror(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def mirror(%Community{} = target_community, article, community_tag_ids \\ []) do
    article = Repo.preload(article, :communities)

    with {:ok, thread} <- thread_of(article) do
      communities =
        (article.communities ++ [target_community])
        |> Enum.uniq_by(& &1.id)

      Multi.new()
      |> Multi.run(:mirror_target_community, fn _, _ ->
        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(:communities, communities)
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{mirror_target_community: article} ->
        Communities.set_tags(target_community, thread, article, %{
          community_tags: community_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec unmirror(Community.t(), T.article()) :: T.domain_res(T.article())
  def unmirror(%Community{} = target_community, article) do
    article = Repo.preload(article, [:communities, :community, :community_tags])

    case article.community.id == target_community.id do
      true ->
        raise_error(:mirror_article, "can not unmirror original community")

      false ->
        community_tags = tags_without_community(article, target_community)

        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(
          :communities,
          Enum.reject(article.communities, &(&1.slug == target_community.slug))
        )
        |> Ecto.Changeset.put_assoc(:community_tags, community_tags)
        |> Repo.update()
    end
  end

  @spec move(Community.t(), T.article()) :: T.domain_res(T.article())
  @spec move(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def move(%Community{} = target_community, article, community_tag_ids \\ []) do
    article = Repo.preload(article, [:communities, :community, :community_tags])

    with {:ok, thread} <- thread_of(article) do
      original_community = article.community

      Multi.new()
      |> Multi.run(:move_article, fn _, _ ->
        communities =
          (article.communities -- [original_community])
          |> Kernel.++([target_community])
          |> Enum.uniq_by(& &1.id)

        community_tags = tags_without_community(article, original_community)

        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_change(:community_id, target_community.id)
        |> Ecto.Changeset.put_assoc(:communities, communities)
        |> Ecto.Changeset.put_assoc(:community_tags, community_tags)
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{move_article: article} ->
        Communities.set_tags(target_community, thread, article, %{
          community_tags: community_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec mirror_to_home(Community.t(), T.article()) :: T.domain_res(T.article())
  @spec mirror_to_home(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def mirror_to_home(%Community{} = home_community, article, community_tag_ids \\ []) do
    article = Repo.preload(article, [:communities, :community_tags])

    with {:ok, thread} <- thread_of(article) do
      communities =
        (article.communities ++ [home_community])
        |> Enum.uniq_by(& &1.id)

      Multi.new()
      |> Multi.run(:set_community, fn _, _ ->
        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(:communities, communities)
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{set_community: article} ->
        Communities.set_tags(home_community, thread, article, %{
          community_tags: community_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec move_to_blackhole(Community.t(), T.article()) :: T.domain_res(T.article())
  @spec move_to_blackhole(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def move_to_blackhole(%Community{} = blackhole, article, community_tag_ids \\ []) do
    article = Repo.preload(article, [:communities, :community, :community_tags])

    with {:ok, thread} <- thread_of(article) do
      Multi.new()
      |> Multi.run(:set_community, fn _, _ ->
        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_change(:community_id, blackhole.id)
        |> Ecto.Changeset.put_assoc(:communities, [blackhole])
        |> Ecto.Changeset.put_assoc(:community_tags, [])
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{set_community: article} ->
        Communities.set_tags(blackhole, thread, article, %{
          community_tags: community_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
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
    %{community_tags: community_tags} = article
    community_tags -- Enum.filter(community_tags, &(&1.community_id === community_id))
  end

  defp result({:ok, %{set_target_tags: result}}), do: result |> done()
  defp result({:ok, %{mirror_target_community: result}}), do: result |> done()
  defp result({:error, _, result, _steps}), do: {:error, result}
end
