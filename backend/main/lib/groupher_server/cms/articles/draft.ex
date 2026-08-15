defmodule GroupherServer.CMS.Articles.Draft do
  @moduledoc """
  Owns the mutable draft head for every Article thread.

                              official public traffic
                                        |
                                        v
                                  main/public
                                   ^         |
                          publish |         | start editing
                                   |         v
                                  main/draft

      preview/draft -------- promote -------> main/draft

      ArticleSnapshot ------- restore ------> target branch draft

  Arrows copy versioned fields. Public rows never move back to draft, Preview
  branches never contain public rows, and runtime state remains anchored to the
  main/public physical row.
  """

  import Ecto.Changeset, only: [put_change: 3, put_embed: 3]
  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.BodyBag
  alias CMS.Articles.{Branch, Document, Lifecycle, Lock, VersionedRelations, Writer}
  alias CMS.Assets
  alias CMS.Gate
  alias CMS.Gate.Decision
  alias CMS.Model.{ArticleBranch, ArticleDocument, Author, Community, Embeds}
  alias Helper.{ORM, T}

  require CMS.Const

  @default_article_meta Embeds.ArticleMeta.default_meta()
  @default_emotions Embeds.ArticleEmotion.default_persisted_emotions()

  @doc "Reads one branch-local Article draft by stable logical identity."
  @spec read(Community.t(), T.thread(), Ecto.UUID.t(), ArticleBranch.t() | map() | keyword()) ::
          T.domain_res(T.article())
  def read(%Community{} = community, thread, article_hash_id, branch_ref) do
    with {:ok, branch} <- Branch.resolve(community, thread, branch_ref),
         {:ok, %{model: model}} <- CMS.Artiment.Matcher.match(thread) do
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
          ArticleBranch.t() | map() | keyword()
        ) ::
          T.domain_res(T.article())
  def read_public(%Community{} = community, thread, article_hash_id, branch_ref) do
    with {:ok, branch} <- Branch.resolve(community, thread, branch_ref),
         true <- Branch.main?(branch),
         {:ok, %{model: model}} <- CMS.Artiment.Matcher.match(thread) do
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
      false -> {:error, {:custom, "preview branches do not contain public Articles"}}
      error -> error
    end
  end

  @doc """
  Reads the content shown by an editor.

  Main prefers draft and falls back to public after publish. Preview reads its
  explicit draft only and never falls back to a public Preview row.
  """
  @spec read_editor(
          Community.t(),
          T.thread(),
          Ecto.UUID.t(),
          ArticleBranch.t() | map() | keyword()
        ) ::
          T.domain_res(T.article())
  def read_editor(%Community{} = community, thread, article_hash_id, branch_ref) do
    with {:ok, branch} <- Branch.resolve(community, thread, branch_ref) do
      case read(community, thread, article_hash_id, branch_ref) do
        {:ok, draft} ->
          {:ok, draft}

        {:error, _} when branch.type == CMS.Const.article_branch_type(:main) ->
          read_public(community, thread, article_hash_id, branch_ref)

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
    with {:ok, branch} <- Branch.resolve(community, thread, attrs),
         {:ok, %{model: model}} <- CMS.Artiment.Matcher.match(thread),
         {:ok, body_content} <- parse_body(attrs, thread),
         {:ok, draft_attrs} <- build_attrs(community, branch, attrs, body_content, author) do
      Repo.transaction(fn ->
        with {:ok, draft} <- create_draft_row(model, thread, draft_attrs),
             {:ok, _lifecycle} <-
               Lifecycle.ensure_created(community.id, thread, draft.article_hash_id),
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
    Lock.run(community, thread, article_hash_id, fn ->
      update_unlocked(community, thread, article_hash_id, attrs)
    end)
  end

  @doc """
  Ensures an editable draft exists, then applies the requested update.

  Main copies its public row. Preview copies the selected source branch's public
  Snapshot/current row into a Preview draft without copying runtime state.
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
    Lock.run(community, thread, article_hash_id, fn ->
      with {:ok, editor_article} <- read_editor(community, thread, article_hash_id, attrs),
           {:ok, _canonical_article} <- Gate.access_check(user, :edit, editor_article),
           {:ok, _draft} <-
             ensure_from_public_unlocked(community, thread, article_hash_id, attrs, user) do
        update_unlocked(community, thread, article_hash_id, attrs)
      else
        {:error, %Decision{} = decision} -> {:error, Decision.primary_code(decision)}
      end
    end)
  end

  @doc "Updates a draft while the caller owns the lifecycle lock and transaction."
  @spec update_unlocked(Community.t(), T.thread(), Ecto.UUID.t(), map()) ::
          T.domain_res(T.article())
  def update_unlocked(%Community{} = community, thread, article_hash_id, attrs) do
    with {:ok, draft} <- read(community, thread, article_hash_id, attrs),
         {:ok, body_content} <- maybe_parse_body(attrs, thread),
         {:ok, next_attrs} <- update_attrs(draft, attrs, body_content),
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
    with {:ok, branch} <- Branch.resolve(community, thread, branch_ref) do
      case read(community, thread, article_hash_id, branch) do
        {:ok, draft} ->
          {:ok, draft}

        {:error, _} ->
          create_from_source_public(community, thread, article_hash_id, branch, user)
      end
    end
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

    query =
      model
      |> CMS.Articles.Trash.not_trashed_scope(thread)
      |> CMS.Gate.scope(actor, :read, %{thread: thread, stage: stage, policy_mode: policy_mode})

    case query do
      %Ecto.Query{} = query ->
        query
        |> where([article], article.article_hash_id == ^article_hash_id)
        |> where([article], article.community_id == ^community.id)
        |> where([article], article.branch_id == ^branch.id)
        |> where([article], article.stage == ^stage)
        |> Repo.one()
        |> case do
          nil -> {:error, {:not_exist, model}}
          article -> {:ok, article}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

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
        branch_id: branch.id,
        community_id: community.id,
        author_id: author.id,
        stage: CMS.Const.stage(:draft),
        title: Map.get(attrs, :title),
        digest: digest,
        body_hash: content_body_hash(body_content),
        schema_version: body_content.schema_version
      })
      |> maybe_put_doc_json(body_content, branch.thread == :doc)

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
    do: {:error, {:custom, "Article draft BodyBag is required"}}

  defp maybe_parse_body(%{body_bag: body_bag}, thread),
    do: BodyBag.cast(body_bag, thread: thread)

  defp maybe_parse_body(_attrs, _thread), do: {:ok, nil}

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
          article_hash_id: article_hash_id,
          branch_id: branch.id
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

  defp source_branch(_community, _thread, %ArticleBranch{type: type} = branch)
       when type == CMS.Const.article_branch_type(:main),
       do: {:ok, branch}

  defp source_branch(community, thread, %ArticleBranch{source_branch_id: source_branch_id})
       when not is_nil(source_branch_id),
       do: Branch.resolve(community, thread, source_branch_id)

  defp source_branch(community, thread, _branch) do
    Branch.resolve(community, thread, Branch.main_slug())
  end

  defp version_attrs(article) do
    article
    |> Map.from_struct()
    |> Map.take(article.__struct__.version_fields())
  end

  defp content_body_hash(%BodyBag{body_hash: body_hash}), do: body_hash

  defp document_input(%BodyBag{} = body_bag), do: %{body_bag: body_bag}
end
