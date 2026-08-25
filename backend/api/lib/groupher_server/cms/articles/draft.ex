defmodule GroupherServer.CMS.Articles.Draft do
  require GroupherServer.CMS.Docs.Const
  @moduledoc """
  Owns the mutable draft head for ordinary Articles and Doc content.

                              official public traffic
                                        |
                                        v
                                  main/public
                                   ^         |
                          publish |         | start editing
                                   |         v
                                  main/draft

  Doc branches use the same Draft operations, while their branch identity is
  resolved by `CMS.Docs.Branch`. Ordinary Articles have no branch dimension.

  editor input -> Draft head -> publish boundary -> public Article head
  """

  import Ecto.Changeset, only: [put_change: 3, put_embed: 3]
  import Ecto.Query, warn: false

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.CMS.Articles.{Document, MutationLock, VersionedRelations, Writer}
  alias GroupherServer.CMS.Articles.ErrorCat
  alias GroupherServer.CMS.Articles.Lifecycle, as: ArticleLifecycle
  alias GroupherServer.CMS.Articles.Trash
  alias GroupherServer.CMS.Artiment.BodyBag
  alias GroupherServer.CMS.Artiment.Matcher
  alias GroupherServer.CMS.Assets
  alias GroupherServer.CMS.Docs.Branch
  alias GroupherServer.CMS.Docs.Lifecycle, as: DocLifecycle
  alias GroupherServer.CMS.Gate
  alias GroupherServer.CMS.Gate.Context.Scope.Article, as: ArticleScope
  alias GroupherServer.CMS.Gate.Context.Scope.Doc, as: DocScope
  alias GroupherServer.CMS.Gate.Decision
  alias GroupherServer.CMS.Model.{ArticleDocument, Author, Community, DocBranch, Embeds}
  alias Helper.{ORM, T}

  require CMS.Const

  @default_article_meta Embeds.ArticleMeta.default_meta()
  @default_emotions Embeds.ArticleEmotion.default_persisted_emotions()
  @normalized_keys ~w(
    article_hash_id branch_id branch branch_slug body_bag expected_version version
    title digest slug subtitle link_addr cover_url cover_url_dark community_tags
  )a

  @doc "Reads one branch-local Article draft by stable logical identity."
  @spec read(Community.t(), T.thread(), Ecto.UUID.t(), DocBranch.t() | map() | keyword() | nil) ::
          T.domain_res(T.article())
  def read(%Community{} = community, thread, article_hash_id, branch_ref) do
    with {:ok, branch} <- resolve_branch(community, thread, branch_ref),
         {:ok, %{model: model}} <- Matcher.match(thread) do
      find_active(
        model,
        community,
        thread,
        article_hash_id,
        branch,
        CMS.Const.stage(:draft),
        branch_ref
      )
    end
  end

  @doc "Reads the official main/public row by stable logical identity."
  @spec read_public(
          Community.t(),
          T.thread(),
          Ecto.UUID.t(),
          DocBranch.t() | map() | keyword() | nil
        ) ::
          T.domain_res(T.article())
  def read_public(%Community{} = community, thread, article_hash_id, branch_ref) do
    with {:ok, branch} <- resolve_branch(community, thread, branch_ref),
         {:ok, %{model: model}} <- Matcher.match(thread) do
      find_active(
        model,
        community,
        thread,
        article_hash_id,
        branch,
        CMS.Const.stage(:public),
        branch_ref
      )
    else
      error -> error
    end
  end

  @doc "Reads a branch-local public projection for an internal Doc publish."
  @spec read_branch_public(
          Community.t(),
          T.thread(),
          Ecto.UUID.t(),
          DocBranch.t() | map() | keyword() | nil
        ) :: T.domain_res(T.article())
  def read_branch_public(%Community{} = community, thread, article_hash_id, branch_ref) do
    with {:ok, branch} <- resolve_doc_branch(community, branch_ref),
         {:ok, %{model: model}} <- Matcher.match(thread) do
      find_active(
        model,
        community,
        thread,
        article_hash_id,
        branch,
        CMS.Const.stage(:public),
        actor: :operations,
        policy_mode: :operations
      )
    end
  end

  @doc """
  Reads the content shown by an editor.

  Ordinary Articles prefer their Draft and fall back to Public. Docs resolve
  the editor's explicit branch and never fall back across branches.
  """
  @spec read_editor(
          Community.t(),
          T.thread(),
          Ecto.UUID.t(),
          DocBranch.t() | map() | keyword() | nil
        ) ::
          T.domain_res(T.article())
  def read_editor(%Community{} = community, thread, article_hash_id, branch_ref) do
    with {:ok, branch} <- resolve_branch(community, thread, branch_ref) do
      case read(community, thread, article_hash_id, branch_ref) do
        {:ok, draft} ->
          {:ok, draft}

        {:error, _} ->
          if is_nil(branch) or Branch.main?(branch) do
            read_public(community, thread, article_hash_id, branch_ref)
          else
            {:error, CMS.Articles.ErrorCat.not_exist("Draft")}
          end

        error ->
          error
      end
    end
  end

  @doc "Creates a new Article draft and its derived ArticleDocument."
  @spec create(Community.t(), T.thread(), map(), User.t()) :: T.domain_res(T.article())
  def create(%Community{} = community, thread, attrs, %User{} = user) do
    with {:ok, %Author{} = author} <- Writer.ensure_author_exists(user) do
      create_with_author(community, thread, attrs, author)
    end
  end

  @doc "Creates a new Article draft when the CMS Author is already resolved."
  @spec create_with_author(Community.t(), T.thread(), map(), Author.t()) ::
          T.domain_res(T.article())
  def create_with_author(%Community{} = community, thread, attrs, %Author{} = author) do
    attrs = normalize_attrs(attrs)

    with {:ok, branch} <- resolve_branch(community, thread, attrs),
         {:ok, %{model: model}} <- Matcher.match(thread),
         {:ok, body_content} <- parse_body(attrs, thread),
         {:ok, draft_attrs} <- build_attrs(community, branch, attrs, body_content, author) do
      Repo.transaction(fn ->
        with {:ok, draft} <- create_draft_row(model, thread, draft_attrs),
             {:ok, _lifecycle} <- ensure_lifecycle(community, thread, draft, branch),
             {:ok, draft} <- VersionedRelations.apply_input(draft, attrs),
             {:ok, _document} <- Document.create(draft, document_input(body_content)),
             {:ok, _asset_refs} <- Assets.link_refs(draft, attrs, community: community) do
          draft
        else
          {:error, reason} -> Repo.rollback(reason)
          reason -> Repo.rollback(reason)
        end
      end)
    end
  end

  @doc "Updates an existing Article draft under its lifecycle lock."
  @spec update(Community.t(), T.thread(), Ecto.UUID.t(), map()) :: T.domain_res(T.article())
  def update(%Community{} = community, thread, article_hash_id, attrs) do
    run_locked(community, thread, article_hash_id, attrs, fn ->
      update_unlocked(community, thread, article_hash_id, attrs, require_version?: true)
    end)
  end

  @doc """
  Ensures an editable draft exists, then applies the requested update.

  Ordinary Articles copy their Public row. Docs copy the selected source
  branch's public row into the target branch Draft without copying runtime
  state.
  """
  @spec update_or_create_from_public(
          Community.t(),
          T.thread(),
          Ecto.UUID.t(),
          map(),
          User.t()
        ) :: T.domain_res(T.article())
  def update_or_create_from_public(
        %Community{} = community,
        thread,
        article_hash_id,
        attrs,
        %User{} = user
      ) do
    attrs = normalize_attrs(attrs)

    run_locked(community, thread, article_hash_id, attrs, fn ->
      draft_result = read(community, thread, article_hash_id, attrs)

      with {:ok, editor_article} <- read_editor(community, thread, article_hash_id, attrs),
           {:ok, _canonical_article} <- Gate.access_check(user, :edit, editor_article),
           :ok <- validate_version(editor_article, attrs, require_version?: true),
           {:ok, _draft} <-
             ensure_from_public_unlocked(community, thread, article_hash_id, attrs, user) do
        update_opts =
          if match?({:ok, _draft}, draft_result), do: [require_version?: true], else: []

        update_unlocked(community, thread, article_hash_id, attrs, update_opts)
      else
        {:error, %Decision{} = decision} -> {:error, Decision.primary_error(decision)}
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  @doc "Updates a draft while the caller owns the lifecycle lock and transaction."
  @spec update_unlocked(Community.t(), T.thread(), Ecto.UUID.t(), map(), keyword()) ::
          T.domain_res(T.article())
  def update_unlocked(%Community{} = community, thread, article_hash_id, attrs, opts \\ []) do
    attrs = normalize_attrs(attrs)

    with {:ok, draft} <- read(community, thread, article_hash_id, attrs),
         :ok <- validate_version(draft, attrs, opts),
         {:ok, body_content} <- maybe_parse_body(attrs, thread),
         {:ok, next_attrs} <- update_attrs(draft, attrs, body_content),
         {:ok, next_attrs} <- next_version(draft, next_attrs),
         {:ok, draft} <- maybe_update_draft(draft, next_attrs),
         {:ok, draft} <- VersionedRelations.apply_input(draft, attrs),
         {:ok, _document} <- maybe_update_document(draft, body_content),
         {:ok, _asset_refs} <- Assets.link_refs(draft, attrs) do
      {:ok, draft}
    end
  end

  @doc "Ensures a branch-local Draft exists while the caller owns the Article lock."
  @spec ensure_from_public_unlocked(
          Community.t(),
          T.thread(),
          Ecto.UUID.t(),
          map() | keyword(),
          User.t()
        ) :: T.domain_res(T.article())
  def ensure_from_public_unlocked(
        %Community{} = community,
        thread,
        article_hash_id,
        branch_ref,
        %User{} = user
      ) do
    with {:ok, branch} <- resolve_branch(community, thread, branch_ref) do
      case read(community, thread, article_hash_id, branch) do
        {:ok, draft} ->
          {:ok, draft}

        {:error, _} ->
          create_from_source_public(community, thread, article_hash_id, branch, user)
      end
    end
  end

  defp run_locked(%Community{} = community, :doc, article_hash_id, branch_ref, fun) do
    with {:ok, branch} <- resolve_doc_branch(community, branch_ref) do
      MutationLock.with_article(community, :doc, branch.id, article_hash_id, fun)
    end
  end

  defp run_locked(%Community{} = community, thread, article_hash_id, _branch_ref, fun) do
    MutationLock.with_article(community, thread, article_hash_id, fun)
  end

  defp create_draft_row(model, thread, attrs) do
    meta = Map.merge(@default_article_meta, %{thread: thread})

    struct(model)
    |> model.changeset(attrs)
    |> put_change(:author_id, attrs.author_id)
    |> put_change(:emotions, @default_emotions)
    |> put_embed(:meta, meta)
    |> Repo.insert()
  end

  defp find_active(model, community, thread, article_hash_id, branch, stage, opts) do
    actor =
      option(opts, :actor, if(stage == CMS.Const.stage(:public), do: nil, else: :operations))

    policy_mode =
      option(
        opts,
        :policy_mode,
        if(stage == CMS.Const.stage(:public), do: :public, else: :operations)
      )

    action = if stage == CMS.Const.stage(:draft), do: :read_draft, else: :read

    scope_context = scope_context(thread, stage, policy_mode, branch, opts)

    query =
      model
      |> Trash.not_trashed_scope(thread)
      |> CMS.Gate.scope(actor, action, scope_context)

    case query do
      %Ecto.Query{} = query ->
        query
        |> where([article], article.article_hash_id == ^article_hash_id)
        |> where([article], article.community_id == ^community.id)
        |> maybe_where_branch(branch)
        |> where([article], article.stage == ^stage)
        |> Repo.one()
        |> case do
          nil -> {:error, CMS.Articles.ErrorCat.not_exist(model)}
          article -> {:ok, article}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp scope_context(:doc, :draft, policy_mode, %DocBranch{id: branch_id}, _opts),
    do: DocScope.draft(branch_id, policy_mode)

  defp scope_context(:doc, :public, policy_mode, %DocBranch{id: branch_id}, opts),
    do:
      DocScope.public_branch(branch_id,
        policy_mode: policy_mode,
        include_illegal: option(opts, :include_illegal, false)
      )

  defp scope_context(thread, :draft, policy_mode, _branch, opts),
    do:
      ArticleScope.draft(thread, policy_mode,
        include_illegal: option(opts, :include_illegal, false)
      )

  defp scope_context(thread, :public, policy_mode, _branch, opts),
    do:
      ArticleScope.public(thread,
        policy_mode: policy_mode,
        include_illegal: option(opts, :include_illegal, false)
      )

  defp option(opts, key, default) when is_list(opts), do: Keyword.get(opts, key, default)
  defp option(opts, key, default) when is_map(opts), do: Map.get(opts, key, default)
  defp option(_opts, _key, default), do: default

  defp build_attrs(%Community{} = community, branch, attrs, body_content, %Author{} = author) do
    # A canonical empty Doc has no content digest yet. Article rows still require
    # a non-empty list/search digest, so use the title until content is written.
    digest =
      attrs
      |> article_digest(body_content.digest)
      |> normalize_digest(Map.get(attrs, :title))

    attrs =
      attrs
      |> Map.drop([:body_bag, :branch, :branch_slug])
      |> Map.merge(%{
        article_hash_id: Map.get(attrs, :article_hash_id) || Ecto.UUID.generate(),
        community_id: community.id,
        author_id: author.id,
        stage: CMS.Const.stage(:draft),
        title: Map.get(attrs, :title),
        digest: digest,
        body_hash: content_body_hash(body_content),
        schema_version: body_content.schema_version
      })
      |> maybe_put_doc_json(body_content, not is_nil(branch))

    attrs =
      if branch do
        Map.put(attrs, :branch_id, branch.id)
      else
        attrs
      end

    {:ok, attrs}
  end

  defp update_attrs(draft, attrs, body_content) do
    version_fields = draft.__struct__.version_fields()

    attrs =
      attrs
      |> Map.take(version_fields)
      |> maybe_put_body_content(body_content, Map.has_key?(draft, :json))
      |> maybe_put_digest(attrs, body_content, draft)

    {:ok, attrs}
  end

  defp validate_version(draft, attrs, opts) do
    expected_version = Map.get(attrs, :expected_version)
    required? = Keyword.get(opts, :require_version?, false)

    cond do
      required? and not is_integer(expected_version) ->
        {:error, ErrorCat.draft_version_required()}

      is_nil(expected_version) ->
        :ok

      expected_version == draft.version ->
        :ok

      true ->
        {:error, ErrorCat.draft_conflict()}
    end
  end

  defp next_version(_draft, attrs) when map_size(attrs) == 0, do: {:ok, attrs}

  defp next_version(draft, attrs) do
    {:ok, Map.put(attrs, :version, (draft.version || 1) + 1)}
  end

  defp maybe_put_body_content(attrs, nil, _stores_json?), do: attrs

  defp maybe_put_body_content(attrs, body_content, stores_json?) do
    attrs
    |> Map.put(:body_hash, content_body_hash(body_content))
    |> Map.put(:schema_version, body_content.schema_version)
    |> maybe_put_doc_json(body_content, stores_json?)
  end

  defp maybe_put_doc_json(attrs, %{json: json}, true), do: Map.put(attrs, :json, json)
  defp maybe_put_doc_json(attrs, _body_bag, false), do: attrs

  defp maybe_put_digest(attrs, input_attrs, body_content, draft) do
    if body_content || Map.has_key?(input_attrs, :digest) ||
         Map.has_key?(input_attrs, :subtitle) do
      fallback = (body_content && body_content.digest) || draft.digest
      Map.put(attrs, :digest, article_digest(input_attrs, fallback))
    else
      attrs
    end
  end

  defp normalize_digest(value, _fallback) when is_binary(value) and value != "", do: value
  defp normalize_digest(_value, fallback), do: fallback

  defp article_digest(%{digest: digest}, fallback), do: normalize_digest(digest, fallback)

  defp article_digest(%{subtitle: subtitle}, fallback) do
    normalize_digest(subtitle, fallback)
  end

  defp article_digest(_attrs, fallback), do: fallback

  defp maybe_update_draft(draft, attrs) when map_size(attrs) == 0, do: {:ok, draft}
  defp maybe_update_draft(draft, attrs), do: ORM.update(draft, attrs)

  defp maybe_update_document(_draft, nil), do: {:ok, nil}

  defp maybe_update_document(draft, body_content) do
    Document.update(draft, document_input(body_content))
  end

  defp parse_body(%{body_bag: body_bag}, thread), do: BodyBag.cast(body_bag, thread: thread)

  defp parse_body(_attrs, _thread),
    do: {:error, GroupherServer.ErrorCat.custom("Article draft BodyBag is required")}

  defp maybe_parse_body(%{body_bag: body_bag}, thread),
    do: BodyBag.cast(body_bag, thread: thread)

  defp maybe_parse_body(_attrs, _thread), do: {:ok, nil}

  defp normalize_attrs(attrs) when is_map(attrs) do
    Enum.reduce(@normalized_keys, attrs, fn key, normalized ->
      case Map.fetch(normalized, key) do
        {:ok, _value} ->
          normalized

        :error ->
          case Map.fetch(normalized, Atom.to_string(key)) do
            {:ok, value} -> Map.put(normalized, key, value)
            :error -> normalized
          end
      end
    end)
  end

  defp normalize_attrs(attrs), do: attrs

  defp create_from_source_public(community, thread, article_hash_id, branch, user) do
    with {:ok, source_branch} <- source_branch(community, thread, branch),
         {:ok, public_article} <- read_public(community, thread, article_hash_id, source_branch),
         {:ok, document} <-
           ORM.find_by(ArticleDocument, article_id: public_article.id, thread: thread) do
      attrs =
        public_article
        |> version_attrs()
        |> Map.drop([:cover_url, :cover_url_dark])
        |> Map.merge(%{
          article_hash_id: article_hash_id
        })

      with {:ok, body_bag} <- BodyBag.from_document(document),
           attrs <- Map.put(attrs, :body_bag, body_bag),
           {:ok, draft} <- create(community, thread, attrs, user),
           {:ok, draft} <- VersionedRelations.copy_to_draft(public_article, draft),
           {:ok, _asset_refs} <- Assets.copy_refs(public_article, draft) do
        {:ok, draft}
      end
    end
  end

  defp source_branch(_community, :doc, %DocBranch{type: type} = branch)
       when type == CMS.Docs.Const.doc_branch_type(:main),
       do: {:ok, branch}

  defp source_branch(community, :doc, %DocBranch{source_branch_id: source_branch_id})
       when not is_nil(source_branch_id),
       do: Branch.resolve(community, source_branch_id)

  defp source_branch(community, :doc, _branch) do
    Branch.resolve(community, Branch.main_slug())
  end

  defp source_branch(_community, _thread, nil), do: {:ok, nil}

  defp ensure_lifecycle(community, :doc, draft, %DocBranch{id: branch_id}) do
    DocLifecycle.ensure_created(community.id, branch_id, draft.article_hash_id)
  end

  defp ensure_lifecycle(community, thread, draft, _branch) do
    ArticleLifecycle.ensure_created(community.id, thread, draft.article_hash_id)
  end

  defp resolve_branch(_community, thread, _ref) when thread != :doc, do: {:ok, nil}
  defp resolve_branch(community, :doc, ref), do: resolve_doc_branch(community, ref)

  defp resolve_doc_branch(%Community{} = community, ref), do: Branch.resolve(community, ref)

  defp maybe_where_branch(query, nil), do: query

  defp maybe_where_branch(query, %DocBranch{id: branch_id}),
    do: where(query, [article], article.branch_id == ^branch_id)

  defp version_attrs(article) do
    article
    |> Map.from_struct()
    |> Map.take(article.__struct__.version_fields() ++ [:inner_id, :version])
  end

  defp content_body_hash(%BodyBag{body_hash: body_hash}), do: body_hash

  defp document_input(%BodyBag{} = body_bag), do: %{body_bag: body_bag}
end
