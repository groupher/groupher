defmodule GroupherServer.CMS.Docs do
  @moduledoc """
  Public facade for Doc-only branches, snapshots and release publishing.

  Ordinary Post, Blog and Changelog never enter this boundary.

  Docs branch/editor -> snapshot and tree boundaries -> public Docs release
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Articles.Publish.Doc, as: TargetPublish
  alias CMS.Articles.Publish.Effects, as: PublishEffects
  alias CMS.Docs.BranchVersions
  alias CMS.Articles.Reader, as: ArticleReader
  alias CMS.Docs.Reader, as: DocReader

  alias CMS.Model.{
    Article,
    Author,
    Community,
    DocPublic
  }

  @doc "Reads the current Doc content head shown by the editor; this is not the rich-text editor implementation."
  def read_editor_head(%Community{id: community_id} = community, doc_id, opts \\ []) do
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

  @doc "Updates one branch-scoped stable Doc Draft through the shared Gate and lock chain."
  @spec update_draft(Ecto.UUID.t(), pos_integer(), map(), User.t() | Author.t()) ::
          {:ok, CMS.Model.DocDraft.t()} | {:error, term()}
  def update_draft(doc_id, branch_id, attrs, actor)
      when is_binary(doc_id) and is_integer(branch_id) and is_map(attrs) do
    attrs = put_doc_digest(attrs)

    with {:ok, article} <- stable_doc(doc_id),
         {:ok, author} <- target_author(actor),
         {:ok, user} <- actor_user(actor) do
      with {:ok, draft} <-
             CMS.Gate.Access.with_branch_check(user, :edit, article, branch_id, fn canonical ->
               with {:ok, expected_draft_version} <-
                      ensure_editable_draft(
                        canonical,
                        branch_id,
                        author,
                        Map.fetch!(attrs, :expected_version)
                      ) do
                 CMS.Articles.Draft.Store.update(canonical, attrs, author,
                   branch_id: branch_id,
                   expected_version: expected_draft_version
                 )
               end
             end) do
        materialize_draft(draft, article)
      end
    end
  end

  defp put_doc_digest(%{subtitle: subtitle} = attrs) when is_binary(subtitle),
    do: Map.put_new(attrs, :digest, subtitle)

  defp put_doc_digest(attrs), do: attrs

  defp ensure_editable_draft(article, branch_id, author, expected_version) do
    case CMS.Articles.Draft.Store.get(article, branch_id: branch_id) do
      {:ok, %{version: ^expected_version} = draft} ->
        {:ok, draft.version}

      {:ok, _draft} ->
        {:error, :draft_version_conflict}

      {:error, :not_found} ->
        case DocReader.public(article.id, branch_id, publication_version: expected_version) do
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

  @doc "Publishes a stable Doc Article into one durable branch version."
  @spec publish_branch(Ecto.UUID.t(), pos_integer(), User.t() | Author.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def publish_branch(doc_id, branch_id, actor, opts) when is_binary(doc_id) do
    with {:ok, article} <- stable_doc(doc_id),
         {:ok, author} <- target_author(actor),
         {:ok, user} <- actor_user(actor) do
      with {:ok, result} <-
             CMS.Gate.Access.with_branch_check(user, :publish, article, branch_id, fn canonical ->
               TargetPublish.publish(canonical, branch_id, author, opts)
             end),
           {:ok, result} <- PublishEffects.run(result) do
        {:ok, result}
      end
    end
  end

  @doc "Lists durable published versions scoped to one stable Doc branch."
  @spec list_branch_versions(Ecto.UUID.t(), pos_integer(), keyword()) ::
          {:ok, [map()]} | {:error, term()}
  def list_branch_versions(doc_id, branch_id, opts \\ []) when is_binary(doc_id) do
    with {:ok, article} <- stable_doc(doc_id) do
      {:ok, BranchVersions.list(article, branch_id, opts)}
    end
  end

  @doc "Gets one durable version and its composed immutable Doc content."
  @spec get_branch_version(Ecto.UUID.t(), pos_integer(), pos_integer()) ::
          {:ok, map()} | {:error, :not_found}
  def get_branch_version(doc_id, branch_id, branch_version_id)
      when is_binary(doc_id) and is_integer(branch_version_id) do
    with {:ok, article} <- stable_doc(doc_id) do
      BranchVersions.get(article, branch_id, branch_version_id)
    end
  end

  @doc "Diffs two durable published versions in the same Doc branch."
  @spec diff_versions(Ecto.UUID.t(), pos_integer(), pos_integer(), pos_integer()) ::
          {:ok, map()} | {:error, :not_found}
  def diff_versions(doc_id, branch_id, left_branch_version_id, right_branch_version_id)
      when is_binary(doc_id) and is_integer(left_branch_version_id) and
             is_integer(right_branch_version_id) do
    with {:ok, article} <- stable_doc(doc_id) do
      BranchVersions.diff(article, branch_id, left_branch_version_id, right_branch_version_id)
    end
  end

  @doc "Restores a published Revision into the mutable workspace without moving Public."
  @spec restore_revision_to_draft(
          Ecto.UUID.t(),
          pos_integer(),
          Ecto.UUID.t(),
          User.t() | Author.t(),
          keyword()
        ) ::
          {:ok, CMS.Model.DocDraft.t()} | {:error, term()}
  def restore_revision_to_draft(
        doc_id,
        branch_id,
        revision_id,
        actor,
        opts \\ []
      )
      when is_binary(doc_id) and is_binary(revision_id) do
    with {:ok, article} <- stable_doc(doc_id),
         {:ok, author} <- target_author(actor),
         {:ok, user} <- actor_user(actor) do
      CMS.Gate.Access.with_branch_check(
        user,
        :restore_revision_to_draft,
        article,
        branch_id,
        fn canonical ->
          BranchVersions.restore_revision_to_draft(
            canonical,
            branch_id,
            revision_id,
            author,
            opts
          )
        end
      )
    end
  end

  defp stable_doc(doc_id) do
    case ArticleReader.article(doc_id) do
      {:ok, %Article{thread: :doc} = article} -> {:ok, article}
      {:ok, %Article{}} -> {:error, :not_doc}
      {:error, _} -> {:error, :doc_not_found}
    end
  end

  defp materialize_draft(draft, %Article{} = article) do
    with {:ok, body} <- DocReader.body_draft(draft.body_draft_id),
         {:ok, author} <- DocReader.author(draft.updated_by_id) do
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

  defp materialize_public(%Article{id: article_id, community_id: community_id}, branch_id) do
    with {:ok, %DocPublic{} = public} <- DocReader.public(article_id, branch_id),
         {:ok, version} <- DocReader.branch_version(public.branch_version_id),
         {:ok, revision} <- DocReader.revision(version.revision_id),
         {:ok, extension} <- DocReader.revision_extension(revision.id),
         {:ok, body} <- DocReader.body_snapshot(revision.body_snapshot_id),
         {:ok, author} <- DocReader.author(public.published_by_id) do
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

  defp target_author(%Author{} = author), do: {:ok, author}
  defp target_author(%User{} = user), do: CMS.Articles.Writer.ensure_author_exists(user)
  defp target_author(_actor), do: {:error, :invalid_actor}

  defp actor_user(%User{} = user), do: {:ok, user}
  defp actor_user(%Author{user: %User{} = user}), do: {:ok, user}

  defp actor_user(%Author{user_id: user_id}) do
    case GroupherServer.FrontDesk.fresh_user(user_id) do
      {:ok, %User{} = user} -> {:ok, user}
      {:error, _} -> {:error, :invalid_actor}
    end
  end
end
