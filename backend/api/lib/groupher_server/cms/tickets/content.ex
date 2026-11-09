defmodule GroupherServer.CMS.Tickets.Content do
  @moduledoc """
  Adapts the shared Article Draft, Revision, and Public primitives for Ticket commands.

  Ticket content uses only ArticleDraft, ArticleBodyDraft, ArticleRevision, and
  ArticleBodySnapshot. This module deliberately does not invoke ordinary Article
  publish orchestration, typed extensions, Article tags, stats, or feed effects.
  The caller owns authorization, locks, lifecycle transitions, and the transaction.

      Ticket Command -> Tickets.Content -> Article Draft/Revision/Public primitives
                                      `-> ArticleAssetRef projection
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Draft.Store, as: DraftStore
  alias CMS.Articles.Revision.Persist, as: RevisionPersist

  alias CMS.Model.{
    Article,
    ArticleBodyDraft,
    ArticleDraft,
    ArticleAssetRef,
    ArticleBinding,
    ArticleLifecycle,
    ArticlePublic,
    ArticleRevision,
    Author,
    Community,
    CommunityAsset
  }

  @type draft :: ArticleDraft.t()

  @doc "Creates the Ticket identity, binding, Article Lifecycle, and version 1 content Draft."
  @spec create_workspace(Community.t(), map(), Author.t(), keyword()) ::
          {:ok, %{article: Article.t(), draft: draft()}} | {:error, term()}
  def create_workspace(%Community{} = community, attrs, %Author{} = author, opts \\ []) do
    DraftStore.create_content_loaded(community, :ticket, attrs, author, opts)
  end

  @doc "Copies a currently selected Post or Ticket revision's asset refs into a Ticket Draft."
  @spec clone_revision_refs(Article.t(), ArticleRevision.t(), Article.t(), draft()) ::
          {:ok, :pass} | {:error, term()}
  def clone_revision_refs(
        %Article{thread: source_thread, id: source_id},
        %ArticleRevision{article_id: source_id} = revision,
        %Article{thread: :ticket} = target,
        %ArticleDraft{} = draft
      )
      when source_thread in [:post, :ticket] do
    with %ArticlePublic{revision_id: revision_id} <- Repo.get(ArticlePublic, source_id),
         true <- revision_id == revision.id,
         {:ok, community_id} <- shared_community(source_id, target.id) do
      copy_revision_refs(revision.id, draft.body_draft_id, community_id)
    else
      false -> {:error, :public_revision_changed}
      nil -> {:error, :public_revision_not_found}
      {:error, _reason} = error -> error
    end
  end

  def clone_revision_refs(_source, _revision, _target, _draft) do
    {:error, :invalid_ticket_asset_clone}
  end

  @doc "Copies same-Community Ticket Draft asset refs into a new Ticket Draft."
  @spec clone_ticket_draft_refs(Article.t(), draft(), Article.t(), draft()) ::
          {:ok, :pass} | {:error, term()}
  def clone_ticket_draft_refs(
        %Article{thread: :ticket, id: source_id},
        %ArticleDraft{article_id: source_id, body_draft_id: source_body_id},
        %Article{thread: :ticket} = target,
        %ArticleDraft{} = target_draft
      ) do
    with {:ok, community_id} <- shared_community(source_id, target.id) do
      copy_body_draft_refs(source_body_id, target_draft.body_draft_id, community_id)
    end
  end

  def clone_ticket_draft_refs(_source, _source_draft, _target, _target_draft) do
    {:error, :invalid_ticket_asset_clone}
  end

  @doc "Loads or creates the current workspace from a locked Published Ticket."
  @spec ensure_workspace(Article.t(), Author.t(), keyword()) ::
          {:ok, draft()} | {:error, term()}
  def ensure_workspace(%Article{thread: :ticket} = article, %Author{} = author, opts) do
    case DraftStore.get(article) do
      {:ok, draft} ->
        {:ok, draft}

      {:error, :not_found} ->
        case Repo.get_by(ArticleLifecycle, article_id: article.id) do
          %ArticleLifecycle{state: :published, version: version} ->
            if version == Keyword.fetch!(opts, :expected_lifecycle_version) do
              with {:ok, draft} <-
                     DraftStore.copy_public_content_loaded(
                       article,
                       author,
                       Keyword.put(opts, :version, 1)
                     ),
                   {:ok, revision} <- get_public_revision(article),
                   {:ok, :pass} <- clone_revision_refs(article, revision, article, draft) do
                {:ok, draft}
              end
            else
              {:error, :lifecycle_version_conflict}
            end

          %ArticleLifecycle{state: :draft} ->
            {:error, :draft_not_found}

          %ArticleLifecycle{} ->
            {:error, :lifecycle_version_conflict}

          nil ->
            {:error, :article_lifecycle_not_found}
        end
    end
  end

  def ensure_workspace(%Article{}, %Author{}, _opts), do: {:error, :invalid_ticket_identity}

  @doc "Returns the current Ticket Draft workspace without creating one."
  @spec get_workspace(Article.t()) :: {:ok, draft()} | {:error, :draft_not_found}
  def get_workspace(%Article{thread: :ticket} = article), do: DraftStore.get(article)

  def get_workspace(%Article{}), do: {:error, :invalid_ticket_identity}

  @doc "Returns the current public revision for a Ticket, if one has been selected."
  @spec get_public_revision(Article.t()) ::
          {:ok, ArticleRevision.t()} | {:error, :public_not_found}
  def get_public_revision(%Article{thread: :ticket, id: article_id}) do
    case Repo.get(ArticlePublic, article_id) do
      %ArticlePublic{revision_id: revision_id} ->
        case Repo.get_by(ArticleRevision, id: revision_id, article_id: article_id) do
          %ArticleRevision{} = revision -> {:ok, revision}
          nil -> {:error, :public_not_found}
        end

      nil ->
        {:error, :public_not_found}
    end
  end

  def get_public_revision(%Article{}), do: {:error, :invalid_ticket_identity}

  @doc "Saves an existing Ticket Draft after checking both publication and Draft versions."
  @spec save_workspace(Article.t(), map(), Author.t(), keyword()) ::
          {:ok, draft()} | {:error, term()}
  def save_workspace(%Article{thread: :ticket} = article, attrs, %Author{} = author, opts) do
    with %ArticleLifecycle{version: version} <-
           Repo.get_by(ArticleLifecycle, article_id: article.id),
         true <- version == Keyword.fetch!(opts, :expected_lifecycle_version),
         {:ok, draft} <- DraftStore.update_content_loaded(article, attrs, author, opts) do
      {:ok, draft}
    else
      false -> {:error, :lifecycle_version_conflict}
      nil -> {:error, :article_lifecycle_not_found}
      {:error, _reason} = error -> error
    end
  end

  def save_workspace(%Article{}, _attrs, %Author{}, _opts), do: {:error, :invalid_ticket_identity}

  @doc "Materializes the locked Ticket Draft as an immutable shared ArticleRevision."
  @spec create_revision(Article.t(), draft()) ::
          {:ok, ArticleRevision.t()} | {:error, term()}
  def create_revision(
        %Article{thread: :ticket, id: article_id} = article,
        %ArticleDraft{article_id: article_id} = draft
      ) do
    case get_public_revision(article) do
      {:ok, %ArticleRevision{content_hash: hash} = revision} when hash == draft.content_hash ->
        {:ok, revision}

      _ ->
        RevisionPersist.create_content(article, draft)
    end
  end

  def create_revision(%Article{}, _draft), do: {:error, :invalid_ticket_draft}

  @doc "Selects a same-Article revision as the current public projection."
  @spec select_public(Article.t(), ArticleRevision.t(), Author.t(), keyword()) ::
          {:ok, ArticlePublic.t()} | {:error, term()}
  def select_public(article, revision, author, opts \\ [])

  def select_public(
        %Article{thread: :ticket} = article,
        %ArticleRevision{} = revision,
        %Author{} = author,
        opts
      ) do
    CMS.Articles.Public.select(article, revision, author, opts)
  end

  def select_public(%Article{}, %ArticleRevision{}, %Author{}, _opts) do
    {:error, :invalid_ticket_identity}
  end

  @doc "Deletes only the mutable Ticket workspace after a successful publish or downgrade."
  @spec delete_workspace(Article.t(), draft()) :: {:ok, :pass} | {:error, term()}
  def delete_workspace(%Article{thread: :ticket} = article, %ArticleDraft{} = draft) do
    DraftStore.delete_content_workspace(article, draft)
  end

  def delete_workspace(%Article{}, _draft), do: {:error, :invalid_ticket_draft}

  @doc "Returns shared content fields for internal Ticket projections."
  @spec draft_content(Article.t()) :: {:ok, map()} | {:error, term()}
  def draft_content(%Article{thread: :ticket} = article) do
    with {:ok, %ArticleDraft{} = draft} <- DraftStore.get(article),
         %ArticleBodyDraft{} = body <- Repo.get(ArticleBodyDraft, draft.body_draft_id) do
      {:ok,
       %{
         body: body,
         content_hash: draft.content_hash,
         digest: draft.digest,
         title: draft.title,
         version: draft.version
       }}
    else
      nil -> {:error, :body_draft_not_found}
      {:error, _reason} = error -> error
    end
  end

  def draft_content(%Article{}), do: {:error, :invalid_ticket_identity}

  defp shared_community(source_id, target_id) do
    target = Repo.get_by(ArticleBinding, article_id: target_id)

    source =
      if target do
        Repo.get_by(ArticleBinding, article_id: source_id, community_id: target.community_id)
      end

    case {source, target} do
      {%ArticleBinding{community_id: community_id}, %ArticleBinding{community_id: community_id}} ->
        {:ok, community_id}

      {nil, _target} ->
        {:error, :source_binding_not_found}

      {_source, nil} ->
        {:error, :target_binding_not_found}

      _ ->
        {:error, :community_mismatch}
    end
  end

  defp copy_revision_refs(revision_id, target_body_draft_id, community_id) do
    refs = Repo.all(from(ref in ArticleAssetRef, where: ref.revision_id == ^revision_id))
    copy_refs(refs, target_body_draft_id, community_id)
  end

  defp copy_body_draft_refs(source_body_draft_id, target_body_draft_id, community_id) do
    refs =
      Repo.all(from(ref in ArticleAssetRef, where: ref.body_draft_id == ^source_body_draft_id))

    copy_refs(refs, target_body_draft_id, community_id)
  end

  defp copy_refs([], _target_body_draft_id, _community_id), do: {:ok, :pass}

  defp copy_refs(refs, target_body_draft_id, community_id) do
    asset_ids = refs |> Enum.map(& &1.asset_id) |> Enum.uniq()

    valid_asset_ids =
      from(asset in CommunityAsset,
        where: asset.id in ^asset_ids and asset.community_id == ^community_id,
        select: asset.id
      )
      |> Repo.all()
      |> MapSet.new()

    if Enum.all?(refs, fn ref ->
         ref.community_id == community_id and MapSet.member?(valid_asset_ids, ref.asset_id)
       end) do
      Enum.reduce_while(refs, {:ok, :pass}, fn ref, {:ok, _} ->
        attrs =
          ref
          |> Map.from_struct()
          |> Map.take(
            ~w(community_id asset_id usage block_id block_type position title alt source meta)a
          )
          |> Map.put(:body_draft_id, target_body_draft_id)

        case %ArticleAssetRef{} |> ArticleAssetRef.changeset(attrs) |> Repo.insert() do
          {:ok, _ref} -> {:cont, {:ok, :pass}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
    else
      {:error, :asset_community_mismatch}
    end
  end
end
