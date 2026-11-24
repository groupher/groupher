defmodule GroupherServerWeb.Resolvers.CMS.ArticleCoAuthors do
  @moduledoc """
  Resolves Article co-author reads and Receipt-protected command entry points.

      GraphQL -> CMS Context -> Article co-author facts and commands
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User

  @doc "Pages co-authors for an article on behalf of the signed-in actor."
  def members(_root, %{article_id: article_id} = args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_members(article_id, actor, Map.get(args, :pagi))
  end

  def members(_root, _args, _resolution), do: {:error, :permission_denied}

  @doc "Searches co-author candidates by name for the specified article and actor."
  def candidates(
        _root,
        %{article_id: article_id, name: name},
        %{context: %{cur_user: %User{} = actor}}
      ) do
    CMS.articles_co_authors_candidates(article_id, actor, name)
  end

  def candidates(_root, _args, _resolution), do: {:error, :permission_denied}

  @doc "Pages co-author requests for the article on behalf of the signed-in actor."
  def requests(_root, %{article_id: article_id} = args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_requests(article_id, actor, Map.get(args, :pagi))
  end

  def requests(_root, _args, _resolution), do: {:error, :permission_denied}

  @doc "Reads the signed-in actor's co-author permissions for an article."
  def permissions(_root, %{article_id: article_id}, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_permissions(article_id, actor)
  end

  def permissions(_root, _args, _resolution), do: {:error, :permission_denied}

  @doc "Creates a co-author request with its type, requested permissions, and optional subject login."
  def create(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_create_request(
      args.article_id,
      Map.get(args, :subject_login),
      args.type,
      args.permissions,
      actor,
      args.command_id
    )
  end

  def create(_root, _args, _resolution), do: {:error, :permission_denied}

  @doc "Decides a co-author request at the supplied revision, with optional approved permissions."
  def decide(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_decide_request(
      args.request_id,
      args.revision,
      args.decision,
      Map.get(args, :approved_permissions),
      actor,
      args.command_id
    )
  end

  def decide(_root, _args, _resolution), do: {:error, :permission_denied}

  @doc "Cancels a co-author request at the supplied revision on behalf of the actor."
  def cancel(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_cancel_request(
      args.request_id,
      args.revision,
      actor,
      args.command_id
    )
  end

  def cancel(_root, _args, _resolution), do: {:error, :permission_denied}

  @doc "Updates an article member's co-author permissions at the expected revision."
  def update_permissions(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_update_permissions(
      args.article_id,
      args.member_id,
      args.revision,
      args.permissions,
      actor,
      args.command_id
    )
  end

  def update_permissions(_root, _args, _resolution), do: {:error, :permission_denied}

  @doc "Removes a co-author from the specified article at the expected membership revision."
  def remove(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_remove_member(
      args.article_id,
      args.member_id,
      args.revision,
      actor,
      args.command_id
    )
  end

  def remove(_root, _args, _resolution), do: {:error, :permission_denied}

  @doc "Ends the actor's own co-author membership at the supplied revision."
  def leave(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_leave_member(
      args.article_id,
      args.revision,
      actor,
      args.command_id
    )
  end

  def leave(_root, _args, _resolution), do: {:error, :permission_denied}
end
