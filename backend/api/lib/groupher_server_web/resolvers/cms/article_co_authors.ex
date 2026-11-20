defmodule GroupherServerWeb.Resolvers.CMS.ArticleCoAuthors do
  @moduledoc """
  Resolves Article co-author reads and Receipt-protected command entry points.

      GraphQL -> CMS Context -> Article co-author facts and commands
  """

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User

  def members(_root, %{article_id: article_id} = args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_members(article_id, actor, Map.get(args, :pagi))
  end

  def members(_root, _args, _resolution), do: {:error, :permission_denied}

  def candidates(
        _root,
        %{article_id: article_id, name: name},
        %{context: %{cur_user: %User{} = actor}}
      ) do
    CMS.articles_co_authors_candidates(article_id, actor, name)
  end

  def candidates(_root, _args, _resolution), do: {:error, :permission_denied}

  def requests(_root, %{article_id: article_id} = args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_requests(article_id, actor, Map.get(args, :pagi))
  end

  def requests(_root, _args, _resolution), do: {:error, :permission_denied}

  def permissions(_root, %{article_id: article_id}, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_permissions(article_id, actor)
  end

  def permissions(_root, _args, _resolution), do: {:error, :permission_denied}

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

  def cancel(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.articles_co_authors_cancel_request(
      args.request_id,
      args.revision,
      actor,
      args.command_id
    )
  end

  def cancel(_root, _args, _resolution), do: {:error, :permission_denied}

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
