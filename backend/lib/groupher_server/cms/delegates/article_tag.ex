defmodule GroupherServer.CMS.Delegate.ArticleTag do
  @moduledoc """
  community curd
  """
  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher
  import Helper.Validator.Guards, only: [g_is_id: 1]
  import Helper.Utils, only: [done: 1, atom_values_to_upcase: 1]

  import GroupherServer.CMS.Delegate.ArticleCRUD,
    only: [ensure_author_exists: 1]

  import ShortMaps
  import Helper.ErrorCode

  alias Helper.ORM
  alias Helper.QueryBuilder
  alias GroupherServer.{Accounts, Repo}

  alias Accounts.Model.User
  alias GroupherServer.CMS

  alias CMS.Model.{ArticleTag, Community}
  alias CMS.Delegate.CommunityCRUD

  alias Ecto.Multi

  @doc """
  create a article tag
  """
  def create_article_tag(%Community{} = community, thread, attrs, %User{
        id: user_id
      }) do
    with {:ok, author} <- ensure_author_exists(%User{id: user_id}),
         {:ok, community} <- ORM.find_by(Community, slug: community.slug) do
      Multi.new()
      |> Multi.run(:create_article_tag, fn _, _ ->
        update_attrs = %{
          author_id: author.id,
          community_id: community.id,
          thread: thread
        }

        attrs = attrs |> Map.merge(update_attrs) |> atom_values_to_upcase

        ORM.create(ArticleTag, attrs)
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        CommunityCRUD.update_community_count_field(
          community,
          :article_tags_count
        )
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc """
  update an article tag
  """
  def update_article_tag(id, attrs) do
    with {:ok, article_tag} <- ORM.find(ArticleTag, id) do
      attrs = attrs |> atom_values_to_upcase
      ORM.update(article_tag, attrs)
    end
  end

  @doc """
  delete an article tag
  """
  def delete_article_tag(id) do
    with {:ok, article_tag} <- ORM.find(ArticleTag, id),
         {:ok, community} <- ORM.find(Community, article_tag.community_id) do
      Multi.new()
      |> Multi.run(:delete_article_tag, fn _, _ ->
        ORM.delete(article_tag)
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        CommunityCRUD.update_community_count_field(
          community,
          :article_tags_count
        )
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  # check if the tag to be set is in same community & thread
  defp is_article_tag_in_some_thread?(article_tag_ids, filter) do
    with {:ok, paged_article_tags} <- paged_article_tags(filter) do
      domain_tags_ids = Enum.map(paged_article_tags.entries, &to_string(&1.id))
      article_tag_ids = Enum.map(article_tag_ids, &to_string(&1))

      Enum.all?(article_tag_ids, &Enum.member?(domain_tags_ids, &1))
    else
      _ -> false
    end
  end

  defp do_overwrite_article_tags(article, tags) do
    article
    |> Repo.preload(:article_tags)
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:article_tags, tags)
    |> Repo.update()
  end

  defp find_article_related_tags(article_tag_ids) do
    from(t in ArticleTag)
    |> where([t], t.id in ^article_tag_ids)
    |> Repo.all()
    |> done()
  end

  @doc """
  set article tag by list of article_tag_ids

  used for create article with article_tags in args
  """
  def overwrite_article_tags(%Community{id: cid}, thread, article, %{
        article_tags: article_tag_ids
      }) do
    check_filter = %{page: 1, size: 100, community_id: cid, thread: thread}

    with true <- is_article_tag_in_some_thread?(article_tag_ids, check_filter),
         {:ok, article} <- do_overwrite_article_tags(article, []),
         {:ok, related_tags} = find_article_related_tags(article_tag_ids) do
      do_overwrite_article_tags(article, related_tags)
    else
      false ->
        raise_error(:invalid_domain_tag, "tag not in same community & thread")
    end
  end

  def set_article_tags(_, _, article, %{article_tags: []}), do: {:ok, article}

  def set_article_tags(%Community{id: cid}, thread, article, %{
        article_tags: article_tag_ids
      }) do
    check_filter = %{page: 1, size: 100, community_id: cid, thread: thread}

    with true <- is_article_tag_in_some_thread?(article_tag_ids, check_filter),
         Enum.each(article_tag_ids, &set_article_tag(thread, article, &1))
         |> done do
      {:ok, article}
    else
      false ->
        raise_error(:invalid_domain_tag, "tag not in same community & thread")
    end
  end

  def set_article_tags(_community, _thread, article, _), do: {:ok, article}

  @doc """
  set article a tag
  """
  def set_article_tag(thread, article_id, tag_id) when g_is_id(article_id) do
    with {:ok, info} <- match(thread),
         {:ok, article} <-
           ORM.find(info.model, article_id, preload: :article_tags),
         {:ok, article_tag} <- ORM.find(ArticleTag, tag_id) do
      do_update_article_tags_assoc(article, article_tag, :add)
    end
  end

  def set_article_tag(_thread, article, tag_id) do
    article = Repo.preload(article, :article_tags)

    with {:ok, article_tag} <- ORM.find(ArticleTag, tag_id) do
      do_update_article_tags_assoc(article, article_tag, :add)
    end
  end

  @doc """
  unset article a tag
  """
  def unset_article_tag(thread, article_id, tag_id) do
    with {:ok, info} <- match(thread),
         {:ok, article} <-
           ORM.find(info.model, article_id, preload: :article_tags),
         {:ok, article_tag} <- ORM.find(ArticleTag, tag_id) do
      do_update_article_tags_assoc(article, article_tag, :remove)
    end
  end

  defp do_update_article_tags_assoc(article, %ArticleTag{} = tag, opt) do
    article_tags =
      case opt do
        :add -> (article.article_tags ++ [tag]) |> Enum.uniq_by(& &1.id)
        :remove -> article.article_tags -- [tag]
      end

    article
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:article_tags, article_tags)
    |> Repo.update()
  end

  @doc """
  get all paged tags
  """
  def paged_article_tags(%{page: page, size: size} = filter) do
    ArticleTag
    |> QueryBuilder.filter_pack(replace_community_ifneed(filter))
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  # if no page info given, load 100 tags by default
  def paged_article_tags(filter) do
    ArticleTag
    |> QueryBuilder.filter_pack(replace_community_ifneed(filter))
    |> ORM.paginator(%{page: 1, size: 100})
    |> done()
  end

  @doc """
  reindex tags in spec group
  """
  def reindex_tags_in_group(community, thread, group, indexed_tags) do
    with {:ok, group_tags} <- _find_group_tags(community, thread, group) do
      group_tags
      |> Enum.each(fn tag ->
        target =
          Enum.find(indexed_tags, fn t ->
            to_string(t.id) === to_string(tag.id)
          end)

        tag
        |> Ecto.Changeset.change(%{index: target.index})
        |> Repo.update()
      end)

      {:ok, :pass}
    end
  end

  defp _find_group_tags(community, thread, group) do
    filter = %{community: community, thread: thread} |> atom_values_to_upcase

    ArticleTag
    |> where([t], t.group == ^group)
    |> QueryBuilder.filter_pack(replace_community_ifneed(filter))
    |> Repo.all()
    |> done
  end

  # QueryBuilder.filter_pack for community is assoc in communities
  # if community is has_one logic, need to used this func to make sure
  # the query is only assoc to community
  defp replace_community_ifneed(filter) when is_map(filter) do
    filter
    |> Enum.map(fn {k, v} ->
      new_key =
        case k do
          :community -> :community_slug
          _ -> k
        end

      {new_key, v}
    end)
    |> Map.new()
  end

  defp result({:ok, %{create_article_tag: result}}), do: {:ok, result}
  defp result({:ok, %{delete_article_tag: result}}), do: {:ok, result}
  defp result({:error, _, result, _steps}), do: {:error, result}
end
