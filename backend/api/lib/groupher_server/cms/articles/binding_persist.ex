defmodule GroupherServer.CMS.Articles.BindingPersist do
  @moduledoc """
  Owns the persistence mechanics used by Article binding Commands inside the
  transaction established by Gate or `CMS.Command`.

      stable Article
        -> mirror / move / unmirror
        -> peer ArticleBinding rows

  Callers are `Articles.Commands.*`; this module is not a product command boundary.
  Its writes preserve the stable Article identity and explicitly manage
  Community-local data when a binding is moved or removed. Docs use their tree
  and branch commands instead of this module.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Numbering

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleBindingTag,
    ArticleLifecycle,
    Community,
    KanbanState,
    PinnedArticle
  }

  @ordinary_threads [:post, :blog, :changelog]

  @doc """
  Moves an Article between explicit source and destination Communities.

  The caller owns the surrounding transaction and aggregate lock.

  ## Examples

      BindingPersist.move(article, source, destination)
      #=> {:ok, canonical_article} | {:error, reason}
  """
  @spec move(Article.t(), Community.t(), Community.t()) :: {:ok, Article.t()} | {:error, term()}
  def move(
        %Article{thread: thread} = article,
        %Community{id: source_community_id} = source,
        %Community{} = destination
      )
      when thread in @ordinary_threads do
    with %Article{} = article <- lock_article(article.id),
         {:ok, :source_matches} <- ensure_source_community(article, source),
         {:ok, :different_community} <- ensure_different_community(source, destination),
         {:ok, binding} <- upsert_binding(article, destination),
         {:ok, _binding} <- Numbering.assign_binding_inner_id(binding),
         {:ok, _} <- delete_source_local_data(article.id, source_community_id),
         {:ok, _deleted_count} <-
           delete_source_binding(article.id, source_community_id, destination.id) do
      {:ok, article}
    else
      nil -> {:error, :article_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def move(%Article{thread: :doc}, %Community{}, %Community{}), do: {:error, :unsupported_for_doc}

  @doc """
  Adds an ordinary Article to a Community without changing stable identity.

  ## Examples

      BindingPersist.mirror(article, community)
      #=> {:ok, %ArticleBinding{}} | {:error, reason}
  """
  @spec mirror(Article.t(), Community.t()) :: {:ok, ArticleBinding.t()} | {:error, term()}
  def mirror(%Article{thread: thread} = article, %Community{} = community)
      when thread in @ordinary_threads do
    with %Article{} = article <- lock_article(article.id),
         {:ok, binding} <- upsert_binding(article, community),
         {:ok, binding} <- Numbering.assign_binding_inner_id(binding) do
      {:ok, binding}
    else
      nil -> {:error, :article_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def mirror(%Article{thread: :doc}, %Community{}), do: {:error, :unsupported_for_doc}

  @doc """
  Removes one ArticleBinding while preserving the published Article identity.

  ## Examples

      BindingPersist.unmirror(article, community)
      #=> {:ok, :done} | {:error, reason}
  """
  @spec unmirror(Article.t(), Community.t()) :: {:ok, :done} | {:error, term()}
  def unmirror(%Article{thread: thread} = article, %Community{} = community)
      when thread in @ordinary_threads do
    with %Article{} = locked_article <- lock_article(article.id),
         %ArticleBinding{} = binding <- lock_binding(locked_article.id, community.id),
         {:ok, :pass} <- ensure_can_remove_published_article(locked_article.id, binding),
         {:ok, _deleted} <- Repo.delete(binding) do
      {:ok, :done}
    else
      nil -> {:error, :article_binding_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def unmirror(%Article{thread: :doc}, %Community{}), do: {:error, :unsupported_for_doc}

  defp lock_binding(article_id, community_id) do
    ArticleBinding
    |> where(
      [binding],
      binding.article_id == ^article_id and binding.community_id == ^community_id
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp ensure_can_remove_published_article(
         _article_id,
         %ArticleBinding{visible: visible, inner_id: inner_id}
       )
       when visible != true or is_nil(inner_id) do
    {:ok, :pass}
  end

  defp ensure_can_remove_published_article(article_id, %ArticleBinding{}) do
    lifecycle = Repo.get_by(ArticleLifecycle, article_id: article_id)

    binding_count =
      Repo.aggregate(
        from(binding in ArticleBinding,
          where:
            binding.article_id == ^article_id and binding.visible == true and
              not is_nil(binding.inner_id)
        ),
        :count
      )

    if lifecycle && lifecycle.state == :published && binding_count <= 1 do
      {:error, :published_article_requires_community}
    else
      {:ok, :pass}
    end
  end

  defp lock_article(article_id) do
    Article
    |> where([article], article.id == ^article_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp ensure_different_community(%Community{id: source_id}, %Community{id: destination_id}) do
    if destination_id == source_id do
      {:error, :already_in_community}
    else
      {:ok, :different_community}
    end
  end

  defp ensure_source_community(%Article{} = article, %Community{id: source_id}) do
    case Repo.get_by(ArticleBinding, article_id: article.id, community_id: source_id) do
      %ArticleBinding{} -> {:ok, :source_matches}
      nil -> {:error, :source_article_binding_not_found}
    end
  end

  defp delete_source_local_data(article_id, source_community_id) do
    binding_ids =
      ArticleBinding
      |> where(article_id: ^article_id, community_id: ^source_community_id)
      |> select([binding], binding.id)
      |> Repo.all()

    Repo.delete_all(from(tag in ArticleBindingTag, where: tag.article_binding_id in ^binding_ids))

    Repo.delete_all(from(pin in PinnedArticle, where: pin.article_binding_id in ^binding_ids))

    Repo.delete_all(from(state in KanbanState, where: state.article_binding_id in ^binding_ids))

    {:ok, :pass}
  end

  defp delete_source_binding(article_id, source_community_id, destination_community_id) do
    {deleted_count, _} =
      Repo.delete_all(
        from(binding in ArticleBinding,
          where:
            binding.article_id == ^article_id and binding.community_id == ^source_community_id and
              binding.community_id != ^destination_community_id
        )
      )

    {:ok, deleted_count}
  end

  defp upsert_binding(article, community) do
    attrs = %{
      article_id: article.id,
      community_id: community.id,
      visible: article.moderation_state != :illegal,
      inner_id: nil
    }

    %ArticleBinding{}
    |> ArticleBinding.changeset(attrs)
    |> Repo.insert(
      on_conflict: [set: [visible: attrs.visible, updated_at: DateTime.utc_now(:second)]],
      conflict_target: [:article_id, :community_id],
      returning: true
    )
  end
end
