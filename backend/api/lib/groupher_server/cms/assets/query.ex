defmodule GroupherServer.CMS.Assets.Query do
  @moduledoc """
  Read-side helpers for the community asset library.

  Billing-oriented reads only look at active rows in `community_assets`. Usage
  reads go through version-owned `article_asset_refs`.

  Business position:

      Dashboard / editor
        -> CMS.Assets
        -> Query
        -> Repo / Assets Hub
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Assets.ThreadIdentity
  alias CMS.Gate.Context.Scope.Ticket, as: TicketContext
  alias CMS.Assets.ErrorCat

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleBinding,
    ArticleDraft,
    ArticleLifecycle,
    ArticlePublic,
    ArticleRevision,
    Community,
    CommunityAsset,
    CommunityLifecycle,
    DocBranch,
    DocBranchState,
    DocDraft,
    DocLifecycle,
    TicketState,
    TrashedArticle
  }

  alias Helper.{ORM, T}
  alias Helper.ORM.Pagi.{Order}
  alias GroupherServer.{Pagi}
  alias Pagi.Params

  @usage_batch_size 100
  @storage_limit_bytes 100 * 1024 * 1024

  @doc """
  Returns a page of active assets for a community.

  This read-side function is the implementation behind `CMS.Assets.page/3`.
  It applies the shared active-asset predicate and orders newest assets first.

  ## Examples

      Query.page(community, %{}, %Params.Offset{page: 1, size: 20})
      #=> {:ok, %Helper.ORM.Pagi.Page.Offset{entries: assets}}

  """
  @spec page(Community.t(), map() | nil, Params.t() | nil) :: T.domain_res(T.paged_data())
  def page(%Community{id: community_id}, filter, pagi) do
    with {:ok, normalized} <- normalize_filter(filter),
         query <-
           community_id
           |> CommunityAsset.active_query()
           |> apply_filter(normalized),
         {:ok, paged} <-
           ORM.pagi(
             query,
             pagi,
             for: CommunityAsset,
             surface: "assets.library",
             query_fingerprint:
               :crypto.hash(:sha256, :erlang.term_to_binary({community_id, normalized}))
               |> Base.encode16(),
             order: %Order{
               fields: [:inserted_at, :id],
               directions: [:desc, :desc],
               cursor_fields: [:inserted_at, :id]
             }
           ) do
      {:ok, paged}
    end
  end

  @doc """
  Returns community asset stats for filter bars and quota display.

  Storage bytes and quota are community-wide active-asset values. Thread and
  type stats are based on `community_assets` ownership fields, not article refs.

  ## Examples

      Query.stats(community, nil)
      #=> {:ok, %{storage_bytes: 4096, storage_limit_bytes: 104857600}}

  """
  @spec stats(Community.t(), map() | nil) :: T.domain_res(map())
  def stats(%Community{id: community_id}, filter) do
    with {:ok, normalized} <- normalize_filter(filter) do
      base_query = community_id |> CommunityAsset.active_query() |> apply_filter(normalized)
      storage = community_storage(community_id)

      {:ok,
       %{
         total_count: total_count(base_query),
         storage_bytes: storage.storage_bytes,
         storage_limit_bytes: @storage_limit_bytes,
         by_thread: thread_stats(base_query),
         by_asset_type: asset_type_stats(base_query)
       }}
    end
  end

  @doc """
  Returns active asset counts and storage bytes for one community.

  Usage is computed from `community_assets`, not from refs, so the same uploaded
  object is counted once regardless of how many articles reference it.

  ## Examples

      Query.usage(community)
      #=> {:ok, %{asset_count: 2, storage_bytes: 4096}}

  """
  @spec usage(Community.t()) :: T.domain_res(map())
  def usage(%Community{id: community_id}) do
    result = community_storage(community_id)

    {:ok, normalize_usage_result(result)}
  end

  @doc """
  Returns a page of article document refs for one active asset.

  The asset lookup is scoped to the supplied community before refs are loaded,
  which prevents cross-community ref discovery.

  ## Examples

      Query.refs(community, asset.id, %{page: 1, size: 10})
      #=> {:ok, %Helper.ORM.Pagi.Page.Offset{entries: refs}}

  """
  @spec refs(Community.t(), T.id(), Params.t() | nil) :: T.domain_res(T.paged_data())
  def refs(%Community{id: community_id}, asset_id, pagi) do
    with {:ok, %CommunityAsset{id: asset_id}} <- find_active_asset(community_id, asset_id) do
      ArticleAssetRef
      |> where([ref], ref.community_id == ^community_id and ref.asset_id == ^asset_id)
      |> join(:left, [ref], draft in ArticleDraft, on: draft.body_draft_id == ref.body_draft_id)
      |> join(:left, [ref, _draft], doc_draft in DocDraft,
        on: doc_draft.body_draft_id == ref.body_draft_id
      )
      |> join(:left, [ref, _draft, _doc_draft], revision in ArticleRevision,
        on: revision.id == ref.revision_id
      )
      |> join(:inner, [ref, draft, doc_draft, revision], article in Article,
        on:
          article.id == draft.article_id or article.id == doc_draft.article_id or
            article.id == revision.article_id
      )
      |> select_merge([ref, _draft, _doc_draft, _revision, article], %{
        article_id: article.id,
        thread: article.thread
      })
      |> then(fn query ->
        with {:ok, paged} <-
               ORM.pagi(
                 query,
                 pagi,
                 for: ArticleAssetRef,
                 surface: "assets.refs",
                 query_fingerprint:
                   :erlang.term_to_binary({community_id, asset_id}) |> Base.encode64(),
                 order: %Order{
                   fields: [:inserted_at, :id],
                   directions: [:desc, :desc],
                   cursor_fields: [:inserted_at, :id]
                 }
               ) do
          {:ok, paged}
        end
      end)
    end
  end

  @doc false
  def active_asset(community_id, asset_id), do: find_active_asset(community_id, asset_id)

  @doc """
  Returns version-owned refs in bounded batches classified by lifecycle role.

  This is a replacement-plan snapshot, not a public paged collection: rows are
  read in fixed 100-row batches, and draft visibility is expressed by the
  page-level predicates matching the Gate edit lifecycle contract. The bounded
  workflow keeps the asset delete / replace contract deterministic without
  loading an unbounded ref set at once or opening one mutation transaction per
  draft row.

  ## Examples

      Query.usages(community, asset_id, actor)
      #=> {:ok, [%{lifecycle: :live}]}
  """
  @spec usages(Community.t(), T.id(), term()) :: T.domain_res([map()])
  def usages(%Community{} = community, asset_id, actor) do
    with {:ok, %CommunityAsset{id: asset_id}} <- find_active_asset(community.id, asset_id),
         {:ok, _community} <- CMS.Gate.access_check(actor, :read, community) do
      ticket_ids = ticket_scope_ids(community, actor)

      collect_usage_batches(
        usage_query(community.id, asset_id, ticket_ids),
        1,
        [],
        &format_usage_row/1
      )
    end
  end

  @doc """
  Returns bounded usage snapshots for asset replacement planning.

  In addition to the public usage fields, each row carries the loaded Draft,
  Public, and Lifecycle facts required to classify a plan item without
  per-Article reads. These internal snapshots must not be exposed by
  `usages/3`.
  """
  @spec replacement_usages(Community.t(), T.id(), term()) :: T.domain_res([map()])
  def replacement_usages(%Community{} = community, asset_id, actor) do
    with {:ok, %CommunityAsset{id: asset_id}} <- find_active_asset(community.id, asset_id),
         {:ok, _community} <- CMS.Gate.access_check(actor, :read, community) do
      collect_usage_batches(
        usage_query(community.id, asset_id, ticket_scope_ids(community, actor)),
        1,
        [],
        &format_replacement_usage_row/1
      )
    end
  end

  @doc "Returns counts using the same classified rows as the Used In drawer."
  @spec usage_summary(Community.t(), T.id(), term()) :: T.domain_res(map())
  def usage_summary(%Community{} = community, asset_id, actor) do
    with {:ok, usages} <- usages(community, asset_id, actor) do
      counts = Enum.frequencies_by(usages, & &1.lifecycle)

      {:ok,
       %{
         live: Map.get(counts, :live, 0),
         draft: Map.get(counts, :draft, 0),
         historical: Map.get(counts, :historical, 0),
         trashed: Map.get(counts, :trashed, 0),
         total: length(usages)
       }}
    end
  end

  defp usage_query(community_id, asset_id, ticket_ids) do
    from(ref in ArticleAssetRef,
      where: ref.community_id == ^community_id and ref.asset_id == ^asset_id,
      left_join: draft in ArticleDraft,
      on: draft.body_draft_id == ref.body_draft_id,
      left_join: doc_draft in DocDraft,
      on: doc_draft.body_draft_id == ref.body_draft_id,
      left_join: revision in ArticleRevision,
      on: revision.id == ref.revision_id,
      join: article in Article,
      on:
        article.id == draft.article_id or article.id == doc_draft.article_id or
          article.id == revision.article_id,
      left_join: current_draft in ArticleDraft,
      on: current_draft.article_id == article.id,
      left_join: binding in ArticleBinding,
      on: binding.article_id == article.id and binding.community_id == ref.community_id,
      join: community_lifecycle in CommunityLifecycle,
      on: community_lifecycle.community_id == ref.community_id,
      left_join: article_lifecycle in ArticleLifecycle,
      on: article_lifecycle.article_id == article.id,
      left_join: branch in DocBranch,
      on: branch.id == doc_draft.branch_id and branch.community_id == ref.community_id,
      left_join: doc_lifecycle in DocLifecycle,
      on: doc_lifecycle.article_id == article.id and doc_lifecycle.branch_id == branch.id,
      left_join: doc_branch_state in DocBranchState,
      on: doc_branch_state.article_id == article.id and doc_branch_state.branch_id == branch.id,
      left_join: public in ArticlePublic,
      on: public.article_id == article.id,
      left_join: trash in TrashedArticle,
      on: trash.article_id == article.id,
      where:
        (is_nil(ref.body_draft_id) or
           not is_nil(trash.id) or
           (not is_nil(binding.id) and community_lifecycle.state == :active and
              ((article.thread != :doc and article_lifecycle.state in [:draft, :published]) or
                 (article.thread == :doc and not is_nil(doc_draft.id) and
                    not is_nil(branch.id) and doc_lifecycle.state in [:draft, :published] and
                    not is_nil(doc_branch_state.id))))) and
          (article.thread != :ticket or article.id in subquery(ticket_ids)),
      select: {
        ref,
        article,
        current_draft,
        doc_draft,
        public,
        trash,
        article_lifecycle,
        doc_lifecycle,
        community_lifecycle,
        branch
      }
    )
  end

  defp ticket_scope_ids(community, actor) do
    gate_community = %{community | slug: community.slug || ""}

    case CMS.Gate.scope(TicketState, actor, :read, TicketContext.internal(gate_community)) do
      {:ok, query} ->
        select(query, [ticket_state: state], state.article_id)

      {:error, _reason} ->
        case CMS.Gate.scope(TicketState, nil, :read, TicketContext.public(gate_community)) do
          {:ok, query} -> select(query, [ticket_state: state], state.article_id)
          {:error, _reason} -> from(state in TicketState, where: false, select: state.article_id)
        end
    end
  end

  defp collect_usage_batches(query, page, batches, formatter) do
    rows =
      query
      |> order_by([ref], desc: ref.inserted_at, desc: ref.id)
      |> limit(^@usage_batch_size)
      |> offset(^((page - 1) * @usage_batch_size))
      |> Repo.all()

    batch =
      rows
      |> Enum.map(formatter)

    if length(rows) == @usage_batch_size do
      collect_usage_batches(query, page + 1, [batch | batches], formatter)
    else
      {:ok, (batches |> Enum.reverse() |> List.flatten()) ++ batch}
    end
  end

  defp format_usage_row(
         {ref, article, _draft, _doc_draft, public, trash, article_lifecycle, doc_lifecycle, _, _}
       ) do
    Map.merge(Map.from_struct(ref), %{
      article_id: article.id,
      thread: article.thread,
      lifecycle: lifecycle(ref, article, public, trash, article_lifecycle, doc_lifecycle)
    })
  end

  defp format_replacement_usage_row({
         ref,
         article,
         draft,
         doc_draft,
         public,
         trash,
         article_lifecycle,
         doc_lifecycle,
         community_lifecycle,
         branch
       }) do
    {ref, article, draft, doc_draft, public, trash, article_lifecycle, doc_lifecycle,
     community_lifecycle, branch}
    |> format_usage_row()
    |> Map.merge(%{
      branch_id: branch && branch.id,
      resource_lifecycle: article_lifecycle || doc_lifecycle,
      community_lifecycle: community_lifecycle,
      observed_draft_version: draft_version(draft, doc_draft),
      observed_live_revision_id: public && public.revision_id
    })
  end

  defp draft_version(%ArticleDraft{version: version}, _doc_draft), do: version
  defp draft_version(_draft, %DocDraft{version: version}), do: version
  defp draft_version(_draft, _doc_draft), do: nil

  @doc """
  Returns public-read origin metadata for one active asset public ref.

  This is the Phoenix source-of-truth lookup used by assets-hub before it reads
  any provider object. It intentionally exposes only lifecycle and storage
  routing fields needed by the public origin.

  ## Examples

      Query.origin_info("asset_xxx")
      #=> {:ok, %CommunityAsset{public_ref: "asset_xxx", status: :active}}

  """
  @spec origin_info(String.t()) :: T.domain_res(CommunityAsset.t())
  def origin_info(public_ref) when is_binary(public_ref) do
    public_ref = String.trim(public_ref)

    CommunityAsset
    |> where([asset], asset.public_ref == ^public_ref)
    |> where([asset], not is_nil(asset.storage))
    |> where([asset], not is_nil(asset.storage_key))
    |> where([asset], is_nil(asset.deleted_at))
    |> where([asset], asset.status == :active)
    |> Repo.one()
    |> case do
      nil -> {:error, ErrorCat.not_exist("asset not found")}
      asset -> {:ok, asset}
    end
  end

  def origin_info(_), do: {:error, ErrorCat.not_exist("asset not found")}

  defp lifecycle(
         %ArticleAssetRef{},
         _article,
         _public,
         %TrashedArticle{},
         _article_lifecycle,
         _doc_lifecycle
       ),
       do: :trashed

  defp lifecycle(
         %ArticleAssetRef{body_draft_id: body_draft_id},
         _article,
         _public,
         _trash,
         _article_lifecycle,
         _doc_lifecycle
       )
       when not is_nil(body_draft_id) do
    :draft
  end

  defp lifecycle(
         %ArticleAssetRef{revision_id: revision_id},
         %Article{thread: :ticket},
         %ArticlePublic{revision_id: revision_id},
         _trash,
         %ArticleLifecycle{state: :published},
         _doc_lifecycle
       ) do
    :live
  end

  defp lifecycle(
         %ArticleAssetRef{revision_id: revision_id},
         %Article{thread: :ticket},
         %ArticlePublic{revision_id: revision_id},
         _trash,
         _article_lifecycle,
         _doc_lifecycle
       ) do
    :historical
  end

  defp lifecycle(
         %ArticleAssetRef{revision_id: revision_id},
         _article,
         %ArticlePublic{revision_id: revision_id},
         _trash,
         _article_lifecycle,
         _doc_lifecycle
       ) do
    :live
  end

  defp lifecycle(
         %ArticleAssetRef{revision_id: _revision_id},
         _article,
         _public,
         _trash,
         _article_lifecycle,
         _doc_lifecycle
       ) do
    :historical
  end

  defp normalize_filter(nil) do
    {:ok,
     %{
       asset_type: nil,
       query: nil,
       subtypes: [],
       thread: nil
     }}
  end

  defp normalize_filter(filter) do
    with {:ok, thread} <- normalize_thread(get_filter(filter, :thread)) do
      {:ok,
       %{
         asset_type: normalize_asset_type(get_filter(filter, :asset_type)),
         query: normalize_query(get_filter(filter, :query)),
         subtypes: normalize_subtypes(get_filter(filter, :subtypes)),
         thread: thread
       }}
    end
  end

  defp apply_filter(query, %{
         asset_type: asset_type,
         query: search,
         subtypes: subtypes,
         thread: thread
       }) do
    query
    |> apply_thread_filter(thread)
    |> apply_asset_type_filter(asset_type)
    |> apply_query_filter(search)
    |> apply_subtype_filter(subtypes)
  end

  defp apply_thread_filter(query, nil), do: query
  defp apply_thread_filter(query, thread), do: where(query, [asset], asset.thread == ^thread)

  defp apply_asset_type_filter(query, nil), do: query

  defp apply_asset_type_filter(query, asset_type) do
    where(query, [asset], asset.asset_type == ^asset_type)
  end

  defp apply_query_filter(query, nil), do: query

  defp apply_query_filter(query, search) do
    pattern = "%#{search}%"

    where(
      query,
      [asset],
      ilike(asset.title, ^pattern) or ilike(asset.filename, ^pattern)
    )
  end

  defp apply_subtype_filter(query, []), do: query

  defp apply_subtype_filter(query, subtypes) do
    where(
      query,
      [asset],
      fragment("lower(split_part(?, '/', 2))", asset.mime_type) in ^subtypes or
        fragment("lower(regexp_replace(?, '^.*\\.', ''))", asset.filename) in ^subtypes
    )
  end

  defp community_storage(community_id) do
    community_id
    |> CommunityAsset.active_query()
    |> select([asset], %{
      asset_count: count(asset.id),
      storage_bytes: coalesce(sum(asset.size_bytes), 0)
    })
    |> Repo.one()
    |> normalize_usage_result()
  end

  defp total_count(query), do: Repo.aggregate(query, :count, :id)

  defp thread_stats(query) do
    counts =
      query
      |> where([asset], not is_nil(asset.thread))
      |> group_by([asset], asset.thread)
      |> select([asset], %{thread: asset.thread, count: count(asset.id)})
      |> Repo.all()
      |> Map.new(&{&1.thread, &1.count})

    ThreadIdentity.values()
    |> Enum.map(&%{thread: &1, count: Map.get(counts, &1, 0)})
  end

  defp asset_type_stats(query) do
    rows =
      query
      |> group_by([asset], [asset.asset_type, asset.mime_type, asset.filename])
      |> select([asset], %{
        asset_type: asset.asset_type,
        count: count(asset.id),
        filename: asset.filename,
        mime_type: asset.mime_type
      })
      |> Repo.all()

    rows
    |> Enum.group_by(& &1.asset_type)
    |> Enum.map(fn {asset_type, rows} ->
      %{
        asset_type: asset_type,
        count: Enum.reduce(rows, 0, &(&1.count + &2)),
        subtypes: subtype_stats(rows)
      }
    end)
    |> Enum.sort_by(&to_string(&1.asset_type))
  end

  defp subtype_stats(rows) do
    rows
    |> Enum.group_by(&subtype_from_row/1)
    |> Enum.reject(fn {subtype, _rows} -> is_nil(subtype) end)
    |> Enum.map(fn {subtype, rows} ->
      %{key: subtype, label: subtype, count: Enum.reduce(rows, 0, &(&1.count + &2))}
    end)
    |> Enum.sort_by(& &1.key)
  end

  defp subtype_from_mime(nil), do: nil

  defp subtype_from_mime(mime_type) when is_binary(mime_type) do
    mime_type
    |> String.downcase()
    |> String.split("/", parts: 2)
    |> case do
      [_type, subtype] -> subtype |> String.split(["+", ";"], parts: 2) |> List.first()
      _ -> nil
    end
  end

  defp subtype_from_row(%{filename: filename, mime_type: mime_type}) do
    subtype_from_extension(filename) || subtype_from_mime(mime_type)
  end

  defp subtype_from_extension(nil), do: nil

  defp subtype_from_extension(filename) when is_binary(filename) do
    case filename |> String.downcase() |> String.split(".") do
      [_] -> nil
      parts -> List.last(parts)
    end
  end

  defp normalize_asset_type(nil), do: nil

  defp normalize_asset_type(asset_type) when asset_type in [:image, :video, :audio, :file] do
    asset_type
  end

  defp normalize_asset_type(asset_type) when is_binary(asset_type) do
    asset_type
    |> String.downcase()
    |> String.to_existing_atom()
    |> normalize_asset_type()
  rescue
    ArgumentError -> nil
  end

  defp normalize_asset_type(_), do: nil

  defp normalize_thread(nil), do: {:ok, nil}
  defp normalize_thread(thread), do: ThreadIdentity.to_atom(thread)

  defp normalize_query(nil), do: nil

  defp normalize_query(query) when is_binary(query) do
    query = String.trim(query)
    if query == "", do: nil, else: query
  end

  defp normalize_query(_), do: nil

  defp normalize_subtypes(nil), do: []

  defp normalize_subtypes(subtypes) when is_list(subtypes) do
    subtypes
    |> Enum.map(&normalize_subtype/1)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  end

  defp normalize_subtypes(_), do: []

  defp normalize_subtype(subtype) when is_binary(subtype) do
    subtype = subtype |> String.trim() |> String.downcase()
    if subtype == "", do: nil, else: subtype
  end

  defp normalize_subtype(_), do: nil

  defp get_filter(filter, key) when is_map(filter) do
    Map.get(filter, key) || Map.get(filter, to_string(key))
  end

  defp get_filter(_, _), do: nil

  defp normalize_usage_result(nil), do: %{asset_count: 0, storage_bytes: 0}

  defp normalize_usage_result(%{storage_bytes: %Decimal{} = bytes} = result) do
    %{result | storage_bytes: Decimal.to_integer(bytes)}
  end

  defp normalize_usage_result(result), do: result

  defp find_active_asset(community_id, asset_id) do
    community_id
    |> CommunityAsset.active_query(asset_id)
    |> Repo.one()
    |> case do
      nil -> {:error, ErrorCat.not_exist("asset not found")}
      asset -> {:ok, asset}
    end
  end

  @doc false
  def asset(community_id, asset_id) do
    Repo.get_by(CommunityAsset, id: asset_id, community_id: community_id)
  end

  @doc false
  def asset(asset_id), do: Repo.get(CommunityAsset, asset_id)

  @doc false
  def community(id), do: Repo.get(Community, id)
end
