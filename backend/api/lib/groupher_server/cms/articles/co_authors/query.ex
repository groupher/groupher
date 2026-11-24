defmodule GroupherServer.CMS.Articles.CoAuthors.Query do
  @moduledoc """
  Actor-scoped Article co-author and request reads.

      canonical Article + viewer -> manager or subject filter -> paged records
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Pagi, Repo}
  alias Accounts.Model.User
  alias CMS.Model.{Article, ArticleCoAuthor, ArticleCoAuthorRequest, Author}
  alias Helper.ORM
  alias Helper.ORM.Pagi.Order

  @doc "Pages Article members; only an Article manager sees the full roster and permissions."
  def members(%Article{} = article, %User{} = actor, pagi_input) do
    with {:ok, :pass} <- manager(article, actor),
         {:ok, pagi} <- Pagi.from_input(pagi_input) do
      query =
        from(member in ArticleCoAuthor,
          where: member.article_id == ^article.id,
          join: author in Author,
          on: author.id == member.author_id,
          join: user in User,
          on: user.id == author.user_id,
          select: {member, user}
        )

      with {:ok, page} <-
             ORM.pagi(query, pagi,
               for: ArticleCoAuthor,
               order: %Order{
                 fields: [:inserted_at, :id],
                 directions: [:desc, :desc],
                 cursor_fields: [:inserted_at, :id]
               },
               surface: "articles.coauthors.members",
               query_fingerprint: fingerprint({article.id, actor.id})
             ) do
        entries =
          Enum.map(page.entries, fn {member, user} ->
            %{
              member_id: member.id,
              article_id: member.article_id,
              author_id: member.author_id,
              revision: member.revision,
              permissions: permission_keys(member.permissions),
              joined_at: member.joined_at,
              user: user
            }
          end)

        {:ok, %{page | entries: entries}}
      end
    end
  end

  @doc "Searches bounded invite candidates for an Article manager, excluding its owner, members, and pending subjects."
  def candidates(%Article{} = article, %User{} = actor, name) when is_binary(name) do
    with {:ok, :pass} <- manager(article, actor),
         name <- String.trim(name),
         true <- name != "",
         {:ok, users} <- Accounts.search_user(name) do
      member_user_ids =
        from(member in ArticleCoAuthor,
          join: author in Author,
          on: author.id == member.author_id,
          where: member.article_id == ^article.id,
          select: author.user_id
        )
        |> Repo.all()
        |> MapSet.new()

      pending_user_ids =
        from(request in ArticleCoAuthorRequest,
          where: request.article_id == ^article.id and request.status == :pending,
          select: request.subject_user_id
        )
        |> Repo.all()
        |> MapSet.new()

      owner_user_id =
        case Repo.get(Author, article.author_id) do
          %Author{user_id: user_id} -> user_id
          _ -> nil
        end

      excluded = member_user_ids |> MapSet.union(pending_user_ids) |> MapSet.put(owner_user_id)

      {:ok,
       users
       |> Enum.reject(&MapSet.member?(excluded, &1.id))}
    else
      false -> {:ok, []}
      {:error, _reason} = error -> error
    end
  end

  def candidates(_, _, _), do: {:error, :invalid_article_co_author_candidate_search}

  @doc "Pages requests visible to the manager or current request subject."
  def requests(%Article{} = article, %User{} = actor, pagi_input) do
    manager? = manager?(article, actor)

    with {:ok, pagi} <- Pagi.from_input(pagi_input) do
      query =
        from(request in ArticleCoAuthorRequest,
          where: request.article_id == ^article.id,
          where: ^manager? or request.subject_user_id == ^actor.id
        )

      with {:ok, page} <-
             ORM.pagi(query, pagi,
               for: ArticleCoAuthorRequest,
               order: %Order{
                 fields: [:inserted_at, :id],
                 directions: [:desc, :desc],
                 cursor_fields: [:inserted_at, :id]
               },
               surface: "articles.coauthors.requests",
               query_fingerprint: fingerprint({article.id, actor.id, manager?})
             ) do
        entries = Enum.map(page.entries, &present_request/1)
        {:ok, %{page | entries: entries}}
      end
    end
  end

  @doc "Returns only the viewer's effective Article permissions after visibility checks."
  def permissions(%Article{} = article, %User{} = actor) do
    with {:ok, scope} <- CMS.Passport.load_article_scope(actor, article),
         {:ok, manager?} <- CMS.Passport.allowed?(actor, scope, "article.author.manage") do
      public? = public_article?(article, actor)

      member? = not is_nil(scope.membership)

      if public? or manager? or member? do
        {:ok,
         %{
           article_id: article.id,
           is_owner: scope.owner_user_id == actor.id,
           permissions: effective_permissions(scope, actor)
         }}
      else
        {:error, :article_not_found}
      end
    end
  end

  defp public_article?(%Article{thread: :doc} = article, actor) do
    article
    |> public_scope(actor, CMS.Gate.Context.Scope.Doc.public())
  end

  defp public_article?(%Article{} = article, actor) do
    article
    |> public_scope(actor, CMS.Gate.Context.Scope.Article.public(article.thread))
  end

  defp public_scope(article, actor, context) do
    query = CMS.Gate.scope(Article, actor, :list, context)

    case query do
      %Ecto.Query{} = query ->
        Repo.exists?(from(candidate in query, where: candidate.id == ^article.id))

      _ ->
        false
    end
  end

  @doc "Loads one Article by ID for the GraphQL request boundary."
  def load_article(article_id) when is_binary(article_id) do
    case Repo.get(Article, article_id) |> maybe_preload_author() do
      %Article{} = article -> {:ok, article}
      nil -> {:error, :article_not_found}
    end
  end

  def load_article(_), do: {:error, :article_not_found}

  @doc "Loads one co-author request by ID for the command facade."
  def load_request(request_id) when is_binary(request_id) do
    case Repo.get(ArticleCoAuthorRequest, request_id) do
      %ArticleCoAuthorRequest{} = request -> {:ok, request}
      nil -> {:error, :request_not_found}
    end
  end

  @doc "Loads the current member row for one Article User, if a membership exists."
  def member_for_user(%Article{} = article, user_id) when is_integer(user_id) do
    with %Author{} = author <- Repo.get_by(Author, user_id: user_id) do
      Repo.get_by(ArticleCoAuthor, article_id: article.id, author_id: author.id)
    else
      nil -> nil
    end
  end

  def member_for_user(_, _), do: nil

  @doc "Rejects legacy default-copy paths for an active co-author of this Article."
  def reject_member_working_copy_access(%Article{thread: :doc} = article, %User{} = actor) do
    case member_for_user(article, actor.id) do
      %ArticleCoAuthor{} -> {:error, CMS.Gate.ErrorCat.permission_denied()}
      nil -> {:ok, :pass}
    end
  end

  def reject_member_working_copy_access(_, _), do: {:ok, :pass}

  @doc "Returns the current manager check using the Article scoped Gate action."
  def manager?(%Article{} = article, %User{} = actor) do
    case CMS.Gate.access_check(actor, :manage_coauthors, article) do
      {:ok, _} -> true
      _ -> false
    end
  end

  defp manager(article, actor) do
    if manager?(article, actor), do: {:ok, :pass}, else: {:error, :permission_denied}
  end

  defp maybe_preload_author(%Article{author: %Ecto.Association.NotLoaded{}} = article) do
    Repo.preload(article, author: :user)
  end

  defp maybe_preload_author(%Article{} = article), do: article

  defp effective_permissions(scope, actor) do
    {:ok, entries} = CMS.Passport.Catalog.list(:article)

    Enum.flat_map(entries, fn entry ->
      case CMS.Passport.allowed?(actor, scope, entry.action) do
        {:ok, true} -> [entry.action]
        _ -> []
      end
    end)
  end

  @doc "Projects a co-author request into the actor-facing request result shape."
  def present_request(%ArticleCoAuthorRequest{} = request) do
    %{
      id: request.id,
      article_id: request.article_id,
      subject_user_id: request.subject_user_id,
      created_by_id: request.created_by_id,
      type: request.type,
      status: request.status,
      decision: request.decision,
      revision: request.revision,
      proposed_permissions: request.proposed_permissions,
      approved_permissions: request.approved_permissions,
      expires_at: request.expires_at,
      decided_at: request.decided_at,
      cancelled_at: request.cancelled_at,
      subject_user: Repo.get(User, request.subject_user_id),
      created_by: Repo.get(User, request.created_by_id)
    }
  end

  @doc "Presents a member mutation result with the required stable User identity."
  def present_member(%ArticleCoAuthor{} = member) do
    with %Author{user_id: user_id} <- Repo.get(Author, member.author_id),
         %User{} = user <- Repo.get(User, user_id) do
      {:ok,
       %{
         member_id: member.id,
         article_id: member.article_id,
         author_id: member.author_id,
         revision: member.revision,
         permissions: permission_keys(member.permissions),
         joined_at: member.joined_at,
         user: user
       }}
    else
      _ -> {:error, :article_co_author_not_found}
    end
  end

  defp permission_keys(permissions) do
    permissions
    |> Enum.filter(fn {_key, value} -> value == true end)
    |> Enum.map(&elem(&1, 0))
    |> Enum.sort()
  end

  defp fingerprint(value), do: :erlang.term_to_binary(value) |> Base.encode64()
end
