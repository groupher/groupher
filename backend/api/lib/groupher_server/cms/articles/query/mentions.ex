defmodule GroupherServer.CMS.Articles.Query.Mentions do
  @moduledoc """
  Confirms public Article and Doc identities in batches.

      Mention references -> Gate scoped resource queries -> public Article bindings
  """
  import Ecto.Query, warn: false
  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions.Config
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Model.{Article, ArticleBinding, Community}
  @threads Config.threads()

  @doc "Loads existing Article identities in one trusted batch, regardless of visibility."
  def existing(ids) when is_list(ids) do
    ids =
      ids
      |> Enum.flat_map(fn value ->
        case Ecto.UUID.cast(value) do
          {:ok, id} -> [id]
          :error -> []
        end
      end)
      |> Enum.uniq()

    case ids do
      [] ->
        %{}

      _ ->
        Article
        |> where([article], article.id in ^ids)
        |> select([article], struct(article, [:id, :thread]))
        |> Repo.all()
        |> Map.new(&{&1.id, &1})
    end
  end

  def validate_types(candidates) do
    ids =
      candidates
      |> Enum.filter(&(Map.get(&1, :type) in @threads))
      |> Enum.flat_map(fn candidate ->
        case Ecto.UUID.cast(Map.get(candidate, :value)) do
          {:ok, id} -> [id]
          _ -> []
        end
      end)
      |> Enum.uniq()

    types =
      case ids do
        [] ->
          %{}

        _ ->
          from(a in Article, where: a.id in ^ids, select: {a.id, a.thread})
          |> Repo.all()
          |> Map.new()
      end

    mismatched? =
      Enum.any?(candidates, fn candidate ->
        case Map.get(types, Map.get(candidate, :value)) do
          nil -> false
          type -> type != Map.get(candidate, :type)
        end
      end)

    if mismatched? do
      {:error, :mention_target_type_mismatch}
    else
      validate_locator_types(candidates)
    end
  end

  defp validate_locator_types(candidates) do
    locators =
      Enum.flat_map(candidates, fn candidate ->
        case Map.get(candidate, :value) do
          {:article_path, slug, inner_id} -> [{slug, inner_id, candidate.type}]
          {:comment_path, slug, thread, inner_id, _comment_id} -> [{slug, inner_id, thread}]
          _ -> []
        end
      end)
      |> Enum.uniq()

    if locators == [] do
      {:ok, :pass}
    else
      filter =
        Enum.reduce(locators, dynamic(false), fn {slug, inner_id, _type}, acc ->
          dynamic(
            [_article, binding, community],
            ^acc or
              (community.slug == ^slug and binding.inner_id == ^inner_id)
          )
        end)

      actual =
        from(article in Article,
          join: binding in ArticleBinding,
          on: binding.article_id == article.id,
          join: community in Community,
          on: community.id == binding.community_id,
          where: ^filter,
          select: {{community.slug, binding.inner_id}, article.thread}
        )
        |> Repo.all()
        |> Map.new()

      mismatched? =
        Enum.any?(locators, fn {slug, inner_id, type} ->
          case Map.get(actual, {slug, inner_id}) do
            nil -> false
            ^type -> false
            _ -> true
          end
        end)

      if mismatched? do
        {:error, :mention_target_type_mismatch}
      else
        {:ok, :pass}
      end
    end
  end

  def load(candidates) do
    Enum.reject(@threads, &(&1 == :ticket))
    |> Map.new(fn thread ->
      thread_candidates = Enum.filter(candidates, &(&1.type == thread))

      stable_ids =
        thread_candidates
        |> Enum.filter(&is_binary(&1.value))
        |> Enum.map(&cast_article_id(&1.value))
        |> Enum.reject(&is_nil/1)
        |> Enum.uniq()

      path_locators =
        candidates
        |> Enum.filter(&(&1.type == thread))
        |> Enum.map(& &1.value)
        |> Enum.filter(&match?({:article_path, _, _}, &1))
        |> Enum.uniq()

      {thread,
       Map.merge(articles(thread, path_locators), load_stable_articles(thread, stable_ids))}
    end)
  end

  defp load_stable_articles(_thread, []), do: %{}

  defp load_stable_articles(thread, ids) do
    with %Ecto.Query{} = query <- article_scope(thread) do
      query
      |> where([article], article.id in ^ids)
      |> article_projection(thread)
      |> Repo.all()
      |> Enum.sort_by(&{&1.id, &1.community_id})
      |> Enum.reduce(%{}, fn article, acc -> Map.put_new(acc, {article.id, :stable}, article) end)
    else
      _ -> %{}
    end
  end

  def articles(_thread, []), do: %{}

  def articles(thread, locators) do
    with %Ecto.Query{} = query <- article_scope(thread),
         pair_filter <- locator_filter(locators),
         query <- where(query, ^pair_filter),
         query <- article_projection(query, thread),
         rows <- Repo.all(query) do
      Map.new(rows, &{{:article_path, &1.community_slug, &1.inner_id}, &1})
    else
      _ -> %{}
    end
  end

  def by_identity_pairs(_thread, []), do: %{}

  def by_identity_pairs(:doc, pairs) do
    query = article_scope(:doc)

    filter =
      Enum.reduce(pairs, dynamic(false), fn {article_id, community_id, _branch_id}, acc ->
        dynamic(
          [article, gate_article_binding: binding],
          ^acc or
            (article.id == ^article_id and binding.community_id == ^community_id)
        )
      end)

    query
    |> where(^filter)
    |> article_projection(:doc)
    |> Repo.all()
    |> Map.new(fn article ->
      {{article.id, article.community_id, nil}, article}
    end)
  end

  def by_identity_pairs(thread, pairs) do
    query = article_scope(thread)

    filter =
      Enum.reduce(pairs, dynamic(false), fn {article_id, community_id, nil}, acc ->
        dynamic(
          [article, gate_article_binding: binding],
          ^acc or (article.id == ^article_id and binding.community_id == ^community_id)
        )
      end)

    query
    |> where(^filter)
    |> article_projection(thread)
    |> Repo.all()
    |> Map.new(fn article ->
      {{article.id, article.community_id, nil}, article}
    end)
  end

  defp article_scope(:doc) do
    CMS.Gate.scope(Article, nil, :list, DocContext.public_main())
  end

  defp article_scope(thread) do
    CMS.Gate.scope(Article, nil, :list, ArticleContext.public(thread))
  end

  defp article_projection(query, :doc) do
    from(
      [
        article,
        gate_article_binding: binding,
        gate_community: community,
        gate_article_public: public,
        gate_doc_branch: branch
      ] in query,
      select: %{
        id: article.id,
        article_id: article.id,
        branch_id: branch.id,
        thread: article.thread,
        community_id: community.id,
        community_slug: community.slug,
        inner_id: binding.inner_id,
        slug: public.slug,
        title: public.title
      }
    )
  end

  defp article_projection(query, _thread) do
    from(
      [
        article,
        gate_article_binding: binding,
        gate_community: community,
        gate_article_public: public
      ] in query,
      select: %{
        id: article.id,
        article_id: article.id,
        branch_id: nil,
        thread: article.thread,
        community_id: community.id,
        community_slug: community.slug,
        inner_id: binding.inner_id,
        slug: public.slug,
        title: public.title
      }
    )
  end

  defp locator_filter(locators) do
    Enum.reduce(locators, dynamic(false), fn {:article_path, slug, inner_id}, filter ->
      dynamic(
        [gate_article_binding: binding, gate_community: community],
        ^filter or (community.slug == ^slug and binding.inner_id == ^inner_id)
      )
    end)
  end

  defp cast_article_id(value) do
    case Ecto.UUID.cast(value) do
      {:ok, id} -> id
      :error -> nil
    end
  end
end
