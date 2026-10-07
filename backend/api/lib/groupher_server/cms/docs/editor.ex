defmodule GroupherServer.CMS.Docs.Editor do
  @moduledoc """
  Owns Doc editor resource resolution and draft/public result materialization.

      editor request -> stable Doc/branch context -> Draft or Public result
  """

  alias GroupherServer.{Accounts, CMS}
  alias GroupherServer.FrontDesk, as: RootFrontDesk
  alias Accounts.Model.User
  alias CMS.Docs.Store, as: DocStore
  alias CMS.FrontDesk
  alias CMS.Model.{Article, Author, Community, DocPublic}

  @spec read_head(Community.t(), term(), keyword()) :: {:ok, map()} | {:error, term()}
  def read_head(%Community{id: community_id} = community, doc_id, opts) do
    with {:ok, branch} <- CMS.Docs.Branch.resolve(community, opts),
         {:ok, %Article{community_id: ^community_id} = article} <- stable_doc(doc_id),
         {:ok, state} <- CMS.Docs.Lifecycle.state(article.id, branch.id),
         true <- state in [:draft_only, :published, :archived] do
      case CMS.Articles.Draft.Store.get(article, branch_id: branch.id) do
        {:ok, draft} -> materialize_draft(draft, article)
        {:error, :not_found} -> materialize_public(article, branch.id)
      end
    else
      false -> {:error, :doc_not_readable}
      error -> error
    end
  end

  @spec stable_doc(term()) :: {:ok, Article.t()} | {:error, term()}
  def stable_doc(doc_id) do
    case FrontDesk.article(doc_id, mode: :internal) do
      {:ok, %Article{thread: :doc} = article} -> {:ok, article}
      {:ok, %Article{}} -> {:error, :not_doc}
      {:error, _} -> {:error, :doc_not_found}
    end
  end

  @spec target_author(User.t() | Author.t()) :: {:ok, Author.t()} | {:error, term()}
  def target_author(%Author{} = author), do: {:ok, author}
  def target_author(%User{} = user), do: CMS.Articles.Writer.ensure_author_exists(user)
  def target_author(_actor), do: {:error, :invalid_actor}

  @spec actor_user(User.t() | Author.t()) :: {:ok, User.t()} | {:error, term()}
  def actor_user(%User{} = user), do: {:ok, user}
  def actor_user(%Author{user: %User{} = user}), do: {:ok, user}

  def actor_user(%Author{user_id: user_id}) do
    case RootFrontDesk.fresh_user(user_id) do
      {:ok, %User{} = user} -> {:ok, user}
      {:error, _} -> {:error, :invalid_actor}
    end
  end

  @spec put_doc_digest(map()) :: map()
  def put_doc_digest(%{subtitle: subtitle} = attrs) when is_binary(subtitle) do
    Map.put_new(attrs, :digest, subtitle)
  end

  def put_doc_digest(attrs), do: attrs

  @spec ensure_editable_draft(Article.t(), pos_integer(), Author.t(), term()) ::
          {:ok, term()} | {:error, term()}
  def ensure_editable_draft(article, branch_id, author, expected_version) do
    case CMS.Articles.Draft.Store.get(article, branch_id: branch_id) do
      {:ok, %{version: ^expected_version} = draft} ->
        {:ok, draft.version}

      {:ok, _draft} ->
        {:error, :draft_version_conflict}

      {:error, :not_found} ->
        case DocStore.public(article.id, branch_id, publication_version: expected_version) do
          {:ok, %DocPublic{}} ->
            with {:ok, draft} <-
                   CMS.Articles.Draft.Store.ensure_from_public(article, author,
                     branch_id: branch_id
                   ) do
              {:ok, draft.version}
            end

          {:error, _} ->
            {:error, :draft_version_conflict}
        end
    end
  end

  @spec materialize_draft(struct(), Article.t()) :: {:ok, map()} | {:error, term()}
  def materialize_draft(draft, %Article{} = article) do
    with {:ok, body} <- DocStore.body_draft(draft.body_draft_id),
         {:ok, author} <- DocStore.author(draft.updated_by_id) do
      {:ok,
       %{
         id: draft.id,
         article_id: draft.article_id,
         community_id: article.community_id,
         thread: :doc,
         branch_id: draft.branch_id,
         stage: :draft,
         version: draft.version,
         content_hash: draft.content_hash,
         base_revision_id: draft.base_revision_id,
         title: draft.title,
         subtitle: draft.subtitle,
         slug: draft.slug,
         digest: draft.digest,
         inserted_at: draft.inserted_at,
         updated_at: draft.updated_at,
         author: author.user,
         document: body
       }}
    end
  end

  @spec materialize_public(Article.t(), pos_integer()) :: {:ok, map()} | {:error, term()}
  def materialize_public(%Article{id: article_id, community_id: community_id}, branch_id) do
    with {:ok, %DocPublic{} = public} <- DocStore.public(article_id, branch_id),
         {:ok, version} <- DocStore.branch_version(public.branch_version_id),
         {:ok, revision} <- DocStore.revision(version.revision_id),
         {:ok, extension} <- DocStore.revision_extension(revision.id),
         {:ok, body} <- DocStore.body_snapshot(revision.body_snapshot_id),
         {:ok, author} <- DocStore.author(public.published_by_id) do
      {:ok,
       %{
         id: public.id,
         article_id: article_id,
         community_id: community_id,
         thread: :doc,
         branch_id: branch_id,
         stage: :public,
         version: public.publication_version,
         content_hash: revision.content_hash,
         base_revision_id: revision.id,
         title: public.title,
         subtitle: extension.subtitle,
         slug: public.slug,
         digest: public.digest,
         inserted_at: public.inserted_at,
         updated_at: public.updated_at,
         author: author.user,
         document: body
       }}
    else
      _ -> {:error, :not_found}
    end
  end
end
