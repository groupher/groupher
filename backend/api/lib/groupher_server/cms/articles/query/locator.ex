defmodule GroupherServer.CMS.Articles.Query.Locator do
  @moduledoc """
  Resolves a bounded batch of public Article paths with one Gate-scoped query per
  community and thread.

  Business position:

      CMS.FrontDesk.article/1 (list input)
        -> Articles.Query.Locator
        -> Gate Article scope + grouped SQL
        -> ordered path results

  The batch does not load Articles one at a time. Invalid, disabled, and
  non-visible paths are omitted; valid duplicate input paths remain duplicated
  in the returned list.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.ArticlePath
  alias CMS.Communities.Enable
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Review.SnapshotVersion

  alias CMS.Model.{
    Article,
    ArticleBindingTag,
    ArticleLifecycle,
    ArticlePublic,
    ArticlePublicBody,
    ArticleSnapshot,
    ArticleSnapshotTag,
    ArticleSnapshotBlog,
    ArticleSnapshotChangelog,
    ArticleSnapshotDoc,
    ArticleSnapshotPost,
    CommunityTag,
    PinnedArticle
  }

  @max_paths 100

  @doc """
  Reads a bounded public Article path batch using the canonical Gate scope.

  ## Examples

      ```elixir
      GroupherServer.CMS.Articles.Query.Locator.resolve([
        %{community: "groupher", thread: :post, inner_id: 1}
      ])
      ```
  """
  @spec resolve([map()]) :: {:ok, [Article.t()]} | {:error, term()}
  def resolve(paths), do: resolve(paths, nil, mode: :public)

  @doc "Reads a bounded Article path batch using one explicit public/admin policy."
  @spec resolve([map()], term(), keyword()) :: {:ok, [Article.t()]} | {:error, term()}
  def resolve(paths, actor, opts) when is_list(paths) and length(paths) <= @max_paths do
    parsed = parse_paths(paths)
    mode = Keyword.get(opts, :mode, :public)

    with :ok <- validate_mode(mode, actor),
         {:ok, resolved} <- resolve_groups(parsed, actor, mode) do
      {:ok, Enum.flat_map(parsed, &List.wrap(Map.get(resolved, path_key(&1))))}
    end
  end

  def resolve(paths, _actor, _opts) when is_list(paths) do
    {:error, ArticleErrorCat.batch_limit_exceeded(%{limit: @max_paths, actual: length(paths)})}
  end

  def resolve(_paths, _actor, _opts),
    do: {:error, CMS.ErrorCat.invalid_body("Article paths must be a list")}

  defp validate_mode(:public, _actor), do: :ok
  defp validate_mode(:admin, actor) when not is_nil(actor), do: :ok

  defp validate_mode(:admin, _actor),
    do: {:error, CMS.ErrorCat.invalid_body("admin Article batch requires actor")}

  defp validate_mode(_mode, _actor),
    do: {:error, CMS.ErrorCat.invalid_body("unsupported Article batch mode")}

  defp parse_paths(paths) do
    Enum.flat_map(paths, fn path ->
      case ArticlePath.parse(path) do
        {:ok, normalized} -> [normalized]
        {:error, _reason} -> []
      end
    end)
  end

  defp resolve_groups(paths, actor, mode) do
    paths
    |> Enum.group_by(&{&1.community, &1.thread})
    |> Enum.reduce_while({:ok, %{}}, fn {{community, thread}, group}, {:ok, resolved} ->
      case {supported_thread?(thread), Enable.thread?(community, thread)} do
        {true, {:ok, _enabled}} ->
          case resolve_group(community, thread, group, actor, mode) do
            {:ok, results} -> {:cont, {:ok, Map.merge(resolved, results)}}
            {:error, _reason} = error -> {:halt, error}
          end

        _disabled_or_unknown ->
          {:cont, {:ok, resolved}}
      end
    end)
  end

  defp resolve_group(community, thread, paths, actor, mode) do
    inner_ids = paths |> Enum.map(&normalize_inner_id(&1.inner_id)) |> Enum.uniq()
    context = scope_context(thread, mode)

    case CMS.Gate.scope(Article, actor, :list, context) do
      %Ecto.Query{} = query ->
        results =
          query
          |> where(
            [gate_article_binding: binding, gate_community: scoped_community],
            scoped_community.slug == ^community and binding.inner_id in ^inner_ids
          )
          |> select_results(thread)
          |> Repo.all()

        {:ok, project_group(results, thread)}

      {:error, _reason} = error ->
        error
    end
  end

  defp select_results(query, _thread) do
    select(query, [article, gate_article_binding: binding, gate_community: community], %{
      article: article,
      binding: binding,
      community: community,
      inner_id: binding.inner_id
    })
  end

  defp project_group([], _thread), do: %{}

  defp project_group(results, thread) do
    article_ids = Enum.map(results, & &1.article.id) |> Enum.uniq()
    snapshot_rows = current_public_rows(article_ids)

    snapshots =
      Map.new(snapshot_rows, fn {public, body, snapshot} ->
        {public.article_id, {public, body, snapshot}}
      end)

    binding_ids = Enum.map(results, & &1.binding.id)
    tags = community_tags(binding_ids)

    article_tags =
      snapshot_tags(Enum.map(snapshot_rows, fn {_public, _body, snapshot} -> snapshot.id end))

    pinned = pinned_binding_ids(binding_ids)
    lifecycles = lifecycles(article_ids)

    extensions =
      snapshot_extensions(
        thread,
        Enum.map(snapshot_rows, fn {_p, _b, snapshot} -> snapshot.id end)
      )

    articles = results |> Enum.map(& &1.article) |> Repo.preload(author: :user)

    results
    |> Enum.zip(articles)
    |> Enum.reduce(%{}, fn {result, article}, acc ->
      case Map.get(snapshots, article.id) do
        nil ->
          acc

        {public, body, snapshot} ->
          projection = %{
            title: public.title,
            digest: public.digest,
            slug: public.slug,
            body: public_body(body, public.digest),
            snapshot_id: snapshot.id,
            version: SnapshotVersion.from_id(snapshot.id),
            published_at: public.published_at,
            public_updated_at: public.updated_at,
            inserted_at: public.published_at,
            updated_at: public.published_at,
            inner_id: result.inner_id,
            community: result.community,
            community_tags: Map.get(tags, result.binding.id, []),
            article_tags: Map.get(article_tags, snapshot.id, []),
            is_pinned: MapSet.member?(pinned, result.binding.id),
            lifecycle: Map.get(lifecycles, article.id)
          }

          projected =
            article |> Map.merge(projection) |> Map.merge(Map.get(extensions, snapshot.id, %{}))

          key =
            path_key(%{
              community: result.community.slug,
              thread: thread,
              inner_id: result.inner_id
            })

          Map.put(acc, key, projected)
      end
    end)
  end

  defp current_public_rows([]), do: []

  defp current_public_rows(article_ids) do
    Repo.all(
      from(public in ArticlePublic,
        join: body in ArticlePublicBody,
        on: body.article_id == public.article_id and body.snapshot_id == public.snapshot_id,
        join: snapshot in ArticleSnapshot,
        on: snapshot.article_id == public.article_id and snapshot.id == public.snapshot_id,
        where: public.article_id in ^article_ids,
        select: {public, body, snapshot}
      )
    )
  end

  defp public_body(body, digest) do
    body
    |> CMS.Model.ArticleBodyDocument.document()
    |> Map.put(:digest, digest)
  end

  defp community_tags([]), do: %{}

  defp community_tags(binding_ids) do
    Repo.all(
      from(tag in CommunityTag,
        join: assignment in ArticleBindingTag,
        on: assignment.tag_id == tag.id,
        where: assignment.article_binding_id in ^binding_ids,
        order_by: [asc: tag.id],
        select: {assignment.article_binding_id, tag}
      )
    )
    |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
  end

  defp snapshot_tags([]), do: %{}

  defp snapshot_tags(snapshot_ids) do
    Repo.all(
      from(tag in CommunityTag,
        join: assignment in ArticleSnapshotTag,
        on: assignment.tag_id == tag.id,
        where: assignment.snapshot_id in ^snapshot_ids,
        order_by: [asc: tag.index, asc: tag.id],
        select: {assignment.snapshot_id, tag}
      )
    )
    |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
  end

  defp pinned_binding_ids([]), do: MapSet.new()

  defp pinned_binding_ids(binding_ids) do
    Repo.all(
      from(pin in PinnedArticle,
        where: pin.article_binding_id in ^binding_ids,
        select: pin.article_binding_id
      )
    )
    |> MapSet.new()
  end

  defp lifecycles([]), do: %{}

  defp lifecycles(article_ids) do
    Repo.all(from(lifecycle in ArticleLifecycle, where: lifecycle.article_id in ^article_ids))
    |> Map.new(&{&1.article_id, &1})
  end

  defp snapshot_extensions(_thread, []), do: %{}
  defp snapshot_extensions(:post, ids), do: extensions(ArticleSnapshotPost, ids)
  defp snapshot_extensions(:blog, ids), do: extensions(ArticleSnapshotBlog, ids)
  defp snapshot_extensions(:changelog, ids), do: extensions(ArticleSnapshotChangelog, ids)
  defp snapshot_extensions(:doc, ids), do: extensions(ArticleSnapshotDoc, ids)
  defp snapshot_extensions(_thread, _ids), do: %{}

  defp extensions(model, ids) do
    Repo.all(from(row in model, where: row.snapshot_id in ^ids))
    |> Map.new(fn row ->
      fields =
        Map.drop(Map.from_struct(row), [:__meta__, :snapshot_id, :inserted_at, :updated_at])

      {row.snapshot_id, fields}
    end)
  end

  defp scope_context(:doc, mode), do: DocContext.public(policy_mode: policy_mode(mode))

  defp scope_context(thread, mode),
    do: ArticleContext.public(thread, policy_mode: policy_mode(mode))

  defp policy_mode(:admin), do: :owner
  defp policy_mode(:public), do: :public

  defp supported_thread?(:doc), do: true
  defp supported_thread?(thread), do: thread in CMS.Gate.Config.ordinary_article_threads()

  defp path_key(path) do
    {path.community, path.thread, normalize_inner_id(path.inner_id)}
  end

  defp normalize_inner_id(value) when is_integer(value), do: value

  defp normalize_inner_id(value) do
    case Integer.parse(to_string(value)) do
      {parsed, ""} -> parsed
      _ -> -1
    end
  end
end
