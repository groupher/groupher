defmodule GroupherServer.CMS.Insights.Query do
  @moduledoc """
  Owns CMS persistence and Gate scope evaluation required by Article Insights.


  Business position:

      caller -> GroupherServer.CMS.Insights.Query -> result
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Artiment.Matcher
  alias CMS.Gate
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Model.{Article, Community, CommunityAdmin}
  alias CMS.Passport.Scope.Community, as: CommunityScope

  @doc """
  Extracts current community-scoped insight grants from Passport Store.

  ## Examples

      CMS.Insights.passport_granted_community_slugs(viewer)
  """
  @spec passport_granted_community_slugs(term()) :: {:ok, [String.t()]} | {:error, term()}
  def passport_granted_community_slugs(%{id: user_id}) when is_integer(user_id) do
    viewer = %User{id: user_id}

    with {:ok, global_scope} <- CMS.Passport.load_global_scope(viewer) do
      admins =
        Repo.all(
          from(admin in CommunityAdmin,
            join: community in Community,
            on: community.id == admin.community_id,
            where: admin.user_id == ^user_id,
            select: {community, admin}
          )
        )

      Enum.reduce_while(admins, {:ok, []}, fn {community, admin}, {:ok, slugs} ->
        with {:ok, permissions} <-
               CMS.Passport.Catalog.validate_permissions(:community, admin.permissions),
             scope <- %CommunityScope{
               actor_id: user_id,
               community_id: community.id,
               global: global_scope.global,
               community: %{is_lord: admin.is_lord, permissions: permissions}
             },
             {:ok, allowed} <-
               CMS.Passport.allowed?(viewer, scope, CMS.GateAction.article_insights_read()) do
          if allowed do
            {:cont, {:ok, [community.slug | slugs]}}
          else
            {:cont, {:ok, slugs}}
          end
        else
          {:error, _reason} = error -> {:halt, error}
        end
      end)
      |> case do
        {:ok, slugs} -> {:ok, Enum.uniq(slugs)}
        {:error, _reason} = error -> error
      end
    end
  end

  def passport_granted_community_slugs(_viewer), do: {:ok, []}

  @doc "Returns the CMS Article type used by the Analysis projection."
  @spec article_type(map()) :: {:ok, atom()} | {:error, term()}
  def article_type(article) do
    with {:ok, %{artiment: type}} <- Matcher.match_interaction(article),
         true <- type in CMS.Artiment.Threads.article_enums() do
      {:ok, type}
    else
      _ -> {:error, CMS.ErrorCat.invalid_thread()}
    end
  end

  @doc "Authorizes an already loaded Article for Insights reads."
  @spec authorize(Article.t(), term(), atom(), keyword()) ::
          {:ok, :pass} | {:error, term()}
  def authorize(article, viewer, :doc, opts) do
    with {:ok, :pass} <- validate_insights_options(opts) do
      authorize_with_scope(article, viewer, DocContext.insights(passport_opts(opts)), opts)
    end
  end

  def authorize(article, viewer, article_type, opts) do
    with {:ok, :pass} <- validate_insights_options(opts) do
      authorize_with_scope(
        article,
        viewer,
        ArticleContext.insights(article_type, passport_opts(opts)),
        opts
      )
    end
  end

  @doc "Resolves and authorizes a public Article path for an Insights read."
  @spec resolve(map(), term(), keyword()) :: {:ok, map()} | {:error, term()}
  def resolve(article_path, viewer, opts) do
    with {:ok, %{community: community, thread: thread, inner_id: inner_id}} <-
           CMS.ArticlePath.parse(article_path),
         {inner_id, ""} <- Integer.parse(to_string(inner_id)),
         %Ecto.Query{} = query <- insights_scope(thread, viewer, opts),
         query <-
           from([article, gate_community: community_row] in query,
             where:
               article.thread == ^thread and as(:gate_article_binding).inner_id == ^inner_id and
                 (community_row.slug == ^community or community_row.aka == ^community)
           ),
         %Article{} = article <- Repo.one(query) do
      {:ok, article}
    else
      {:error, _reason} = error -> error
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp insights_scope(:doc, viewer, opts) do
    scope_query(DocContext.insights(passport_opts(opts)), viewer)
  end

  defp insights_scope(thread, viewer, opts) do
    scope_query(ArticleContext.insights(thread, passport_opts(opts)), viewer)
  end

  defp scope_query(context, viewer) do
    scope_actor = if global_root?(viewer), do: :operations, else: viewer
    Gate.scope(Article, scope_actor, :read_insights, context)
  end

  defp authorize_with_scope(
         %{id: id, thread: thread},
         viewer,
         %ArticleContext{thread: thread} = context,
         opts
       )
       when is_binary(id) do
    authorize_scoped_article(id, viewer, context, opts)
  end

  defp authorize_with_scope(%{id: id, thread: :doc}, viewer, %DocContext{} = context, opts)
       when is_binary(id) do
    authorize_scoped_article(id, viewer, context, opts)
  end

  defp authorize_with_scope(_article, _viewer, _context, _opts) do
    {:error, GateErrorCat.scope_context_missing()}
  end

  defp authorize_scoped_article(id, viewer, context, opts) do
    scope_actor = if global_root?(viewer), do: :operations, else: viewer

    case scope_query(context, scope_actor) do
      %Ecto.Query{} = query ->
        query = scope_community_option(query, opts)

        if Repo.exists?(from(row in query, where: row.id == ^id)) do
          {:ok, :pass}
        else
          {:error, GateErrorCat.permission_denied()}
        end

      {:error, _reason} = error ->
        error
    end
  end

  defp validate_insights_options(opts) when is_list(opts) do
    case Keyword.fetch(opts, :community) do
      :error -> {:ok, :pass}
      {:ok, %{slug: slug}} when is_binary(slug) -> {:ok, :pass}
      {:ok, slug} when is_binary(slug) -> {:ok, :pass}
      {:ok, _invalid} -> {:error, GateErrorCat.scope_context_missing()}
    end
  end

  defp validate_insights_options(_opts) do
    {:error, GateErrorCat.scope_context_missing()}
  end

  defp scope_community_option(query, opts) do
    case Keyword.fetch(opts, :community) do
      :error ->
        query

      {:ok, %{slug: slug}} when is_binary(slug) ->
        where(
          query,
          [gate_community: community],
          community.slug == ^slug or community.aka == ^slug
        )

      {:ok, slug} when is_binary(slug) ->
        where(
          query,
          [gate_community: community],
          community.slug == ^slug or community.aka == ^slug
        )

      {:ok, _invalid} ->
        query
    end
  end

  defp global_root?(viewer) when is_map(viewer) do
    case CMS.Passport.system_root?(Map.get(viewer, :id)) do
      {:ok, true} -> true
      _ -> false
    end
  rescue
    _ -> false
  end

  defp global_root?(_viewer), do: false

  defp passport_opts(opts) do
    [
      passport_granted_community_slugs:
        opts
        |> Keyword.get(:passport_granted_community_slugs, [])
        |> List.wrap()
    ]
  end
end
