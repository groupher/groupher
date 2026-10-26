defmodule GroupherServer.CMS.Articles.Query.Locator do
  @moduledoc """
  Resolves a bounded batch of public Article paths with one Gate-scoped query per
  community and thread.

  Business position:

      CMS.Articles.locators/1
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
  alias CMS.Model.Article

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
  @spec resolve([map()]) :: {:ok, [map()]} | {:error, term()}
  def resolve(paths) when is_list(paths) and length(paths) <= @max_paths do
    parsed = parse_paths(paths)

    with {:ok, resolved} <- resolve_groups(parsed) do
      {:ok,
       Enum.flat_map(parsed, fn path ->
         case Map.get(resolved, path_key(path)) do
           nil ->
             []

           result ->
             [
               %{
                 path: path,
                 article: result.article,
                 binding: result.binding,
                 branch_id: result.branch_id
               }
             ]
         end
       end)}
    end
  end

  def resolve(paths) when is_list(paths) do
    {:error, ArticleErrorCat.batch_limit_exceeded(%{limit: @max_paths, actual: length(paths)})}
  end

  def resolve(_paths), do: {:error, CMS.ErrorCat.invalid_body("Article paths must be a list")}

  defp parse_paths(paths) do
    Enum.flat_map(paths, fn path ->
      case ArticlePath.parse(path) do
        {:ok, normalized} -> [normalized]
        {:error, _reason} -> []
      end
    end)
  end

  defp resolve_groups(paths) do
    paths
    |> Enum.group_by(&{&1.community, &1.thread})
    |> Enum.reduce_while({:ok, %{}}, fn {{community, thread}, group}, {:ok, resolved} ->
      case {supported_thread?(thread), Enable.thread?(community, thread)} do
        {true, {:ok, _enabled}} ->
          case resolve_group(community, thread, group) do
            {:ok, results} -> {:cont, {:ok, Map.merge(resolved, results)}}
            {:error, _reason} = error -> {:halt, error}
          end

        _disabled_or_unknown ->
          {:cont, {:ok, resolved}}
      end
    end)
  end

  defp resolve_group(community, thread, paths) do
    inner_ids = paths |> Enum.map(&normalize_inner_id(&1.inner_id)) |> Enum.uniq()
    context = scope_context(thread)

    case CMS.Gate.scope(Article, nil, :list, context) do
      %Ecto.Query{} = query ->
        query
        |> where(
          [gate_article_binding: binding, gate_community: scoped_community],
          scoped_community.slug == ^community and binding.inner_id in ^inner_ids
        )
        |> select_results(thread)
        |> Repo.all()
        |> Map.new(fn result ->
          {path_key(%{community: community, thread: thread, inner_id: result.inner_id}), result}
        end)
        |> then(&{:ok, &1})

      {:error, _reason} = error ->
        error
    end
  end

  defp select_results(query, :doc) do
    select(query, [article, gate_article_binding: binding, gate_doc_branch: branch], %{
      article: article,
      binding: binding,
      inner_id: binding.inner_id,
      branch_id: branch.id
    })
  end

  defp select_results(query, _thread) do
    select(query, [article, gate_article_binding: binding], %{
      article: article,
      binding: binding,
      inner_id: binding.inner_id,
      branch_id: nil
    })
  end

  defp scope_context(:doc), do: DocContext.public_main()
  defp scope_context(thread), do: ArticleContext.public(thread)

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
