defmodule GroupherServer.CMS.FrontDesk.Article do
  @moduledoc """
  Resolves public/admin Article paths and trusted internal Article identities.

  Public reads accept a structured Article path and run the canonical Article
  Gate scope before returning the canonical Article with selected public fields.
  Internal identity reads require `mode: :internal`; an explicit Community adds
  the binding context needed for community-scoped resource reads.

  Business position:

      CMS.FrontDesk facade
        -> FrontDesk.Article
        -> ArticlePath parse + Community/ArticleBinding lookup
        -> Gate Scope or trusted internal identity read
        -> Article with selected content and request Community

  For example, a public caller uses `read(path, actor, mode: :public)`. A
  trusted context read uses `read(id, nil, mode: :internal, community: community)`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Review.SnapshotVersion
  alias CMS.Articles.WorkingCopy.Access, as: WorkingCopyAccess
  alias CMS.Communities.Enable
  alias CMS.FrontDesk.Community, as: CommunityFrontDesk
  alias CMS.Gate.Context.Scope.Article, as: ArticleScopeContext
  alias CMS.Gate.Context.Scope.Doc, as: DocScopeContext
  alias CMS.ArticlePath

  @doc "Builds the current resource path, including the required Doc slug."
  def url(%{community_slug: community, thread: thread} = target)
      when is_binary(community) and is_atom(thread) do
    identifier = Map.get(target, :inner_id) || Map.get(target, :article_id)

    if (is_integer(identifier) and identifier > 0) or
         (is_binary(identifier) and identifier != "") do
      base = "/#{community}/#{thread}/#{identifier}"

      if thread == :doc do
        slug = Map.get(target, :slug)
        base <> "/" <> if(is_binary(slug) and slug != "", do: URI.encode(slug), else: "doc")
      else
        base
      end
    end
  end

  def url(_), do: nil

  alias CMS.Model.{
    Article,
    Community,
    ArticleSnapshot,
    ArticleSnapshotTag,
    ArticleWorkingCopy,
    ArticleBinding,
    ArticleLifecycle,
    ArticleSnapshotBlog,
    ArticleSnapshotChangelog,
    ArticleSnapshotDoc,
    ArticleSnapshotPost,
    PinnedArticle,
    PostState
  }

  alias Helper.ORM

  @doc """
  Reads one Article from a public path or a trusted internal ID.

  Public paths are parsed and authorized through Gate before an Article is
  returned. Stable ID reads require an explicit request Community, except
  identity-only trusted internal reads without one.

  ## Examples

      FrontDesk.Article.read(article_path, actor, mode: :public)
      FrontDesk.Article.read(article_id, nil, mode: :internal, community: community)
  """
  @spec read(ArticlePath.t() | String.t(), term(), keyword()) ::
          {:ok, struct()} | {:error, map()}
  def read(article_id, actor, opts) when is_binary(article_id) and is_list(opts) do
    case {Keyword.get(opts, :mode, :public), Keyword.get(opts, :community)} do
      {mode, %Community{} = community} when mode in [:public, :admin, :internal] ->
        read_by_id(article_id, actor, community, opts)

      {:internal, nil} when is_nil(actor) ->
        read_internal(article_id, internal_preload(opts))

      _ ->
        {:error, ArticleErrorCat.article_not_found("Article community context required")}
    end
  end

  def read(article_path, actor, opts) do
    case Keyword.get(opts, :mode, :public) do
      mode when mode in [:public, :admin] ->
        with {:ok, %{community: community, thread: thread, inner_id: inner_id}} <-
               ArticlePath.parse(article_path),
             {:ok, community} <- CommunityFrontDesk.read(community, actor, opts) do
          with {:ok, _thread} <- Enable.thread?(community.slug, thread) do
            read_stable(community, thread, inner_id, actor, opts)
          end
        end

      _mode ->
        {:error, ArticleErrorCat.article_not_found("unsupported Article read mode")}
    end
  end

  defp read_internal(article_id, preload) when is_list(preload) do
    ORM.find(Article, article_id, preload: preload)
  end

  defp read_by_id(article_id, actor, community, opts) do
    with {:ok, _article_id} <- Ecto.UUID.cast(article_id) do
      case Keyword.get(opts, :mode, :public) do
        :internal when is_nil(actor) ->
          with {:ok, article} <- read_internal(article_id, internal_preload(opts)),
               {:ok, binding} <- CMS.Articles.Bindings.get(article, community) do
            {:ok,
             article |> Map.put(:community, community) |> Map.put(:inner_id, binding.inner_id)}
          end

        mode when mode in [:public, :admin] ->
          with {:ok, article} <- ORM.find(Article, article_id),
               {:ok, binding} <- CMS.Articles.Bindings.get(article, community) do
            read_stable(community, article.thread, binding.inner_id, actor, opts)
          end

        _ ->
          {:error, ArticleErrorCat.article_not_found("unsupported Article read mode")}
      end
    else
      _ -> {:error, ArticleErrorCat.article_not_found("Article not found")}
    end
  end

  defp internal_preload(opts) do
    case Keyword.get(opts, :preload) do
      preload when is_list(preload) -> preload
      _ -> []
    end
  end

  @doc """
  Reads a public Article from its external ArticlePath coordinates.

  The caller must provide the already-resolved Community. This function still
  applies the matching Gate scope and returns `article_not_found` for an
  unavailable path; stable IDs alone do not grant public visibility.

  ## Examples

      FrontDesk.Article.read_stable(community, :post, inner_id, actor, [])
  """
  @spec read_stable(Community.t(), atom(), integer() | String.t(), term(), keyword()) ::
          {:ok, Article.t()} | {:error, term()}
  def read_stable(%Community{} = community, thread, inner_id, actor, opts) do
    with {inner_id, ""} <- Integer.parse(to_string(inner_id)),
         {:ok, _thread} <- Enable.thread?(community.slug, thread),
         %Article{} = article <- stable_article(community, thread, inner_id, actor, opts),
         {:ok, article} <- public_article(article, community) do
      {:ok, article}
    else
      nil -> {:error, ArticleErrorCat.article_not_found("article not found")}
      :error -> {:error, ArticleErrorCat.article_not_found("article not found")}
      {:error, _reason} = error -> error
    end
  end

  defp stable_article(%Community{} = community, thread, inner_id, actor, opts) do
    policy_mode =
      if Keyword.get(opts, :mode, :public) == :admin, do: :owner, else: :public

    context =
      if thread == :doc do
        DocScopeContext.public(policy_mode: policy_mode)
      else
        ArticleScopeContext.public(thread, policy_mode: policy_mode)
      end

    with %Ecto.Query{} = query <- CMS.Gate.scope(Article, actor, :read, context) do
      query
      |> where(
        [gate_article_binding: binding, gate_community: scoped_community],
        scoped_community.id == ^community.id and binding.inner_id == ^inner_id
      )
      |> preload([article, ...], author: :user)
      |> select([article, ...], article)
      |> Repo.one()
    end
  end

  defp public_article(%Article{} = article, %Community{} = community) do
    with {:ok, {public, snapshot}} <- CMS.Articles.Public.current(article.id) do
      article = Repo.preload(article, author: :user)
      binding = Repo.get_by(ArticleBinding, article_id: article.id, community_id: community.id)

      with true <- not is_nil(binding),
           {:ok, asset_refs} <- CMS.Assets.content_refs(:snapshot, snapshot.id),
           {:ok, participants} <-
             CMS.ArticleStats.comment_participants(article.thread, article.id),
           {:ok, community_tags} <- CMS.Articles.Bindings.Tags.list(binding),
           article_tags <- snapshot_tags(snapshot.id),
           extension when is_map(extension) <- snapshot_extension(article.thread, snapshot.id),
           {:ok, lifecycle} <- lifecycle(article),
           {:ok, stored_body} <- CMS.Articles.Public.body(public) do
        body = Map.put(stored_body, :digest, public.digest)

        article =
          article
          |> Map.put(:snapshot_id, snapshot.id)
          |> Map.put(:inner_id, binding.inner_id)
          |> Map.put(:title, public.title)
          |> Map.put(:digest, public.digest)
          |> Map.put(:slug, public.slug)
          |> Map.put(:body, body)
          |> Map.put(:asset_refs, asset_refs)
          |> Map.put(:community, community)
          |> Map.put(:community_tags, community_tags)
          |> Map.put(:article_tags, article_tags)
          |> Map.put(:comments_participants, participants)
          |> Map.put(:published_at, public.published_at)
          |> Map.put(:inserted_at, public.published_at)
          |> Map.put(:updated_at, public.published_at)
          |> Map.put(:public_updated_at, public.updated_at)
          |> Map.put(:version, SnapshotVersion.from_id(snapshot.id))
          |> Map.put(:lifecycle, lifecycle)
          |> Map.put(:is_pinned, pinned?(binding.id))
          |> Map.merge(post_state(article))
          |> Map.merge(extension)

        {:ok, article}
      else
        false -> {:error, :article_binding_not_found}
        nil -> {:error, :article_snapshot_projection_missing}
        {:error, _reason} = error -> error
        _ -> {:error, :article_snapshot_projection_missing}
      end
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp snapshot_tags(snapshot_id) do
    Repo.all(
      from(tag in CMS.Model.CommunityTag,
        join: assignment in ArticleSnapshotTag,
        on: assignment.tag_id == tag.id,
        where: assignment.snapshot_id == ^snapshot_id,
        order_by: [asc: tag.index, asc: tag.id]
      )
    )
  end

  defp snapshot_extension(thread, id) do
    case thread do
      :post -> extension(ArticleSnapshotPost, id)
      :blog -> extension(ArticleSnapshotBlog, id)
      :changelog -> extension(ArticleSnapshotChangelog, id)
      :doc -> extension(ArticleSnapshotDoc, id)
      :ticket -> %{}
      _ -> nil
    end
  end

  defp extension(model, id) do
    case Repo.get_by(model, snapshot_id: id) do
      nil -> nil
      row -> Map.drop(Map.from_struct(row), [:__meta__, :snapshot_id, :inserted_at, :updated_at])
    end
  end

  defp post_state(%Article{thread: :post, id: id}) do
    case Repo.get(PostState, id) do
      %PostState{cat: cat} -> %{cat: cat}
      _ -> %{cat: nil}
    end
  end

  defp post_state(_), do: %{}

  defp lifecycle(%Article{id: article_id}) do
    case Repo.get_by(ArticleLifecycle, article_id: article_id) do
      %ArticleLifecycle{} = lifecycle -> {:ok, lifecycle}
      nil -> {:error, :article_snapshot_projection_missing}
    end
  end

  defp pinned?(binding_id) do
    case Repo.get_by(PinnedArticle, article_binding_id: binding_id) do
      nil -> false
      _ -> true
    end
  end

  @doc "Reads one explicitly selected Article Snapshot after community and edit admission checks."
  @spec read_snapshot(String.t(), String.t(), Community.t(), term(), keyword()) ::
          {:ok, ArticleSnapshot.t()} | {:error, term()}
  def read_snapshot(article_id, snapshot_id, %Community{} = community, actor, opts \\ []) do
    with {:ok, _article_id} <- Ecto.UUID.cast(article_id),
         {:ok, _snapshot_id} <- Ecto.UUID.cast(snapshot_id) do
      read_version(article_id, community, actor, opts, fn article ->
        CMS.Articles.snapshot(article, community, snapshot_id)
      end)
    else
      _ -> {:error, ArticleErrorCat.article_not_found("Article Snapshot not found")}
    end
  end

  @doc "Reads one explicitly selected Article WorkingCopy after community and edit admission checks."
  @spec read_working_copy(String.t(), String.t(), Community.t(), term(), keyword()) ::
          {:ok, ArticleWorkingCopy.t()} | {:error, term()}
  def read_working_copy(article_id, working_copy_id, %Community{} = community, actor, opts \\ []) do
    with {:ok, _article_id} <- Ecto.UUID.cast(article_id),
         {:ok, _working_copy_id} <- Ecto.UUID.cast(working_copy_id) do
      read_version(article_id, community, actor, opts, fn article ->
        with {:ok, :pass} <-
               CMS.Articles.CoAuthors.reject_member_working_copy_access(article, actor) do
          CMS.Articles.working_copy(article, community, working_copy_id)
        end
      end)
    else
      _ -> {:error, ArticleErrorCat.article_not_found("Article WorkingCopy not found")}
    end
  end

  defp read_version(article_id, community, actor, opts, load_version) do
    case Keyword.get(opts, :mode, :admin) do
      :admin when not is_nil(actor) ->
        with {:ok, article} <- ORM.find(Article, article_id, preload: [author: :user]),
             {:ok, canonical} <-
               WorkingCopyAccess.access_check(actor, :edit, article, community),
             {:ok, version} <- load_version.(canonical) do
          {:ok, version}
        end

      :internal when is_nil(actor) ->
        with {:ok, article} <- ORM.find(Article, article_id),
             {:ok, version} <- load_version.(article) do
          {:ok, version}
        end

      _ ->
        {:error, ArticleErrorCat.article_not_found("Article version not found")}
    end
  end
end
