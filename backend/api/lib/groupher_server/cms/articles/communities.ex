defmodule GroupherServer.CMS.Articles.Communities do
  @moduledoc """
  Owns Community membership commands for stable ordinary Articles.

      stable Article
        -> one home ArticleCommunity
        -> zero or more mirror ArticleCommunities

  Moving replaces the home relationship and allocates a fresh public number
  in the destination Community. Mirroring never changes stable Article
  identity or the canonical home path. Docs use their tree and branch commands
  instead of this module.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Numbering

  alias CMS.Model.{
    Article,
    ArticleCommunity,
    ArticleCommunityTag,
    Community,
    CommunityTag,
    PinnedArticle
  }

  @ordinary_threads [:post, :blog, :changelog]

  @doc "Moves an ordinary Article home to another Community and assigns a new public number."
  @spec move(Article.t(), Community.t()) :: {:ok, Article.t()} | {:error, term()}
  def move(%Article{thread: thread} = article, %Community{} = destination)
      when thread in @ordinary_threads do
    Repo.transaction(fn ->
      with %Article{} = article <- lock_article(article.id),
           :ok <- ensure_different_home(article, destination),
           {_, _} <- delete_community_relation(article.id, destination.id),
           {_, _} <- delete_home_relation(article.id),
           {:ok, article} <-
             article
             |> Article.changeset(%{community_id: destination.id, inner_id: nil})
             |> Repo.update(),
           {:ok, _relation} <- insert_relation(article, destination, :home),
           {:ok, article} <- Numbering.assign_public_inner_id(article) do
        article
      else
        nil -> Repo.rollback(:article_not_found)
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  def move(%Article{thread: :doc}, %Community{}), do: {:error, :unsupported_for_doc}

  @doc "Adds an ordinary Article to another Community without changing its home path."
  @spec mirror(Article.t(), Community.t()) :: {:ok, ArticleCommunity.t()} | {:error, term()}
  def mirror(%Article{thread: thread} = article, %Community{} = community)
      when thread in @ordinary_threads do
    Repo.transaction(fn ->
      with %Article{} = article <- lock_article(article.id),
           :ok <- ensure_not_home(article.id, community.id),
           {:ok, relation} <- upsert_mirror(article, community) do
        relation
      else
        nil -> Repo.rollback(:article_not_found)
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  def mirror(%Article{thread: :doc}, %Community{}), do: {:error, :unsupported_for_doc}

  @doc "Removes one mirror relationship while preserving the Article and its home relationship."
  @spec unmirror(Article.t(), Community.t()) :: {:ok, :done} | {:error, term()}
  def unmirror(%Article{thread: thread} = article, %Community{} = community)
      when thread in @ordinary_threads do
    case Repo.delete_all(
           from(relation in ArticleCommunity,
             where:
               relation.article_id == ^article.id and relation.community_id == ^community.id and
                 relation.role == :mirror
           )
         ) do
      {0, _} -> {:error, :mirror_not_found}
      {_count, _} -> {:ok, :done}
    end
  end

  def unmirror(%Article{thread: :doc}, %Community{}), do: {:error, :unsupported_for_doc}

  @doc "Pins one Article inside a Community where it already has a visible relationship."
  @spec pin(Article.t(), Community.t()) :: {:ok, PinnedArticle.t()} | {:error, term()}
  def pin(%Article{thread: thread} = article, %Community{} = community)
      when thread in @ordinary_threads do
    case Repo.get_by(ArticleCommunity, article_id: article.id, community_id: community.id) do
      %ArticleCommunity{} = relation ->
        case Repo.get_by(PinnedArticle, article_community_id: relation.id) do
          %PinnedArticle{} = pin ->
            {:ok, pin}

          nil ->
            %PinnedArticle{}
            |> PinnedArticle.changeset(%{
              article_community_id: relation.id,
              community_id: community.id,
              thread: thread
            })
            |> Repo.insert()
        end

      nil ->
        {:error, :article_community_not_found}
    end
  end

  def pin(%Article{thread: :doc}, %Community{}), do: {:error, :unsupported_for_doc}

  @doc "Removes a Community-local pin without changing the Article relationship."
  @spec unpin(Article.t(), Community.t()) :: {:ok, :done} | {:error, term()}
  def unpin(%Article{} = article, %Community{} = community) do
    query =
      from(pin in PinnedArticle,
        join: relation in ArticleCommunity,
        on: relation.id == pin.article_community_id,
        where: relation.article_id == ^article.id and relation.community_id == ^community.id
      )

    case Repo.delete_all(query) do
      {0, _} -> {:error, :pin_not_found}
      {_count, _} -> {:ok, :done}
    end
  end

  @doc "Replaces the Community-local tags attached to one Article Community relationship."
  @spec replace_tags(ArticleCommunity.t(), [pos_integer()]) ::
          {:ok, ArticleCommunity.t()} | {:error, term()}
  def replace_tags(%ArticleCommunity{} = relation, tag_ids) when is_list(tag_ids) do
    Repo.transaction(fn ->
      normalized_ids = normalize_tag_ids(tag_ids)

      if normalized_ids == :error do
        Repo.rollback(:invalid_community_tags)
      end

      valid_ids =
        CommunityTag
        |> where([tag], tag.id in ^normalized_ids and tag.community_id == ^relation.community_id)
        |> select([tag], tag.id)
        |> Repo.all()

      if Enum.sort(valid_ids) != Enum.sort(normalized_ids) do
        Repo.rollback(:invalid_community_tags)
      end

      Repo.delete_all(
        from(tag in ArticleCommunityTag,
          where: tag.article_community_id == ^relation.id
        )
      )

      Enum.each(valid_ids, fn tag_id ->
        %ArticleCommunityTag{}
        |> ArticleCommunityTag.changeset(%{
          article_community_id: relation.id,
          tag_id: tag_id
        })
        |> Repo.insert!()
      end)

      relation
    end)
  end

  @doc "Lists the Community-local tags assigned to an Article relationship."
  @spec tags(Article.t() | %{required(:id) => Ecto.UUID.t()}, Community.t()) ::
          {:ok, [CommunityTag.t()]} | {:error, atom()}
  def tags(%{id: article_id}, %Community{} = community) when is_binary(article_id) do
    query =
      from(tag in CommunityTag,
        join: assignment in ArticleCommunityTag,
        on: assignment.tag_id == tag.id,
        join: relation in ArticleCommunity,
        on: relation.id == assignment.article_community_id,
        where: relation.article_id == ^article_id and relation.community_id == ^community.id,
        order_by: [asc: tag.id]
      )

    case Repo.get_by(ArticleCommunity, article_id: article_id, community_id: community.id) do
      %ArticleCommunity{} -> {:ok, Repo.all(query)}
      nil -> {:error, :article_community_not_found}
    end
  end

  @doc "Lists every home or mirror Community currently exposing an Article."
  @spec communities(Article.t() | %{required(:id) => Ecto.UUID.t()}) :: [Community.t()]
  def communities(%{id: article_id}) when is_binary(article_id) do
    Community
    |> join(:inner, [community], relation in ArticleCommunity,
      on: relation.community_id == community.id
    )
    |> where([_community, relation], relation.article_id == ^article_id)
    |> order_by([community, relation], asc: relation.role, asc: community.id)
    |> Repo.all()
  end

  defp normalize_tag_ids(tag_ids) do
    Enum.reduce_while(tag_ids, [], fn
      id, acc when is_integer(id) and id > 0 -> {:cont, [id | acc]}
      id, acc when is_binary(id) ->
        case Integer.parse(id) do
          {parsed, ""} when parsed > 0 -> {:cont, [parsed | acc]}
          _ -> {:halt, :error}
        end

      _id, _acc ->
        {:halt, :error}
    end)
    |> case do
      :error -> :error
      ids -> ids |> Enum.uniq() |> Enum.reverse()
    end
  end

  defp lock_article(article_id) do
    Article
    |> where([article], article.id == ^article_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp ensure_different_home(%Article{community_id: community_id}, %Community{id: community_id}),
    do: {:error, :already_home}

  defp ensure_different_home(%Article{}, %Community{}), do: :ok

  defp ensure_not_home(article_id, community_id) do
    query =
      from(relation in ArticleCommunity,
        where:
          relation.article_id == ^article_id and relation.community_id == ^community_id and
            relation.role == :home
      )

    if Repo.exists?(query), do: {:error, :already_home}, else: :ok
  end

  defp delete_home_relation(article_id) do
    Repo.delete_all(
      from(relation in ArticleCommunity,
        where: relation.article_id == ^article_id and relation.role == :home
      )
    )
  end

  defp delete_community_relation(article_id, community_id) do
    Repo.delete_all(
      from(relation in ArticleCommunity,
        where: relation.article_id == ^article_id and relation.community_id == ^community_id
      )
    )
  end

  defp insert_relation(article, community, role) do
    %ArticleCommunity{}
    |> ArticleCommunity.changeset(%{
      article_id: article.id,
      community_id: community.id,
      role: role,
      visible: article.moderation_state != :illegal
    })
    |> Repo.insert()
  end

  defp upsert_mirror(article, community) do
    attrs = %{
      article_id: article.id,
      community_id: community.id,
      role: :mirror,
      visible: article.moderation_state != :illegal
    }

    %ArticleCommunity{}
    |> ArticleCommunity.changeset(attrs)
    |> Repo.insert(
      on_conflict: [set: [visible: attrs.visible, updated_at: DateTime.utc_now(:second)]],
      conflict_target: [:article_id, :community_id],
      returning: true
    )
  end
end
