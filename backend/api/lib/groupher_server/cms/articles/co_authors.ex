defmodule GroupherServer.CMS.Articles.CoAuthors do
  @moduledoc """
  Public CMS boundary for Article co-author reads and revisioned commands.

      CMS caller -> CoAuthors facade -> Article request, membership, and Passport rules
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.CoAuthors.Query
  alias CMS.Articles.CoAuthors.Commands.{
    CancelRequest,
    CreateRequest,
    DecideRequest,
    LeaveMember,
    RemoveMember,
    UpdatePermissions
  }
  alias CMS.Model.{ArticleCoAuthor, ArticleCoAuthorRequest}

  @doc "Pages the current Article co-author roster for an authorized Article manager."
  def members(article_id, %User{} = actor, pagi_input) do
    with {:ok, article} <- Query.load_article(article_id) do
      Query.members(article, actor, pagi_input)
    end
  end

  @doc "Searches public user candidates for an authorized Article manager."
  def candidates(article_id, %User{} = actor, name) do
    with {:ok, article} <- Query.load_article(article_id) do
      Query.candidates(article, actor, name)
    end
  end

  @doc "Pages Article co-author requests visible to the manager or request subject."
  def requests(article_id, %User{} = actor, pagi_input) do
    with {:ok, article} <- Query.load_article(article_id) do
      Query.requests(article, actor, pagi_input)
    end
  end

  @doc "Returns the current viewer's effective Article permissions."
  def permissions(article_id, %User{} = actor) do
    with {:ok, article} <- Query.load_article(article_id) do
      Query.permissions(article, actor)
    end
  end

  @doc "Creates an invitation for a public login or an application for the current user."
  def create_request(article_id, subject_login, type, permissions, %User{} = actor, command_id) do
    with {:ok, article} <- Query.load_article(article_id),
         {:ok, subject_id} <- resolve_subject_user_id(subject_login, type, actor),
         {:ok, request} <-
           CreateRequest.execute(article, subject_id, type, permissions, actor, command_id) do
      {:ok, Query.present_request(request)}
    end
  end

  @doc "Decides a revisioned Article co-author request and presents its current membership."
  def decide_request(request_id, revision, decision, approved_permissions, %User{} = actor, command_id) do
    with {:ok, request} <- Query.load_request(request_id),
         {:ok, article} <- Query.load_article(request.article_id),
         {:ok, approved} <- approved_permissions(request, decision, approved_permissions),
         {:ok, {decided, current_member}} <-
           DecideRequest.execute(
             article,
             request.id,
             revision,
             decision,
             approved,
             actor,
             command_id
           ) do
      current_member = present_current_member(current_member)
      {:ok, Map.put(Query.present_request(decided), :current_member, current_member)}
    else
      {:error, _} = error -> error
    end
  end

  @doc "Cancels a pending Article co-author request at its current revision."
  def cancel_request(request_id, revision, %User{} = actor, command_id) do
    with {:ok, request} <- Query.load_request(request_id),
         {:ok, article} <- Query.load_article(request.article_id),
         {:ok, cancelled} <-
           CancelRequest.execute(article, request.id, revision, actor, command_id) do
      {:ok, Query.present_request(cancelled)}
    else
      {:error, _} = error -> error
    end
  end

  @doc "Replaces a co-author's grantable permissions at its current membership revision."
  def update_permissions(article_id, member_id, revision, permissions, %User{} = actor, command_id) do
    with {:ok, article} <- Query.load_article(article_id),
         {:ok, member} <-
           UpdatePermissions.execute(article, member_id, revision, permissions, actor, command_id) do
      Query.present_member(member)
    end
  end

  @doc "Removes one current Article co-author membership."
  def remove_member(article_id, member_id, revision, %User{} = actor, command_id) do
    with {:ok, article} <- Query.load_article(article_id),
         {:ok, member} <- RemoveMember.execute(article, member_id, revision, actor, command_id) do
      Query.present_member(member)
    end
  end

  @doc "Leaves the current user's Article co-author membership."
  def leave_member(article_id, revision, %User{} = actor, command_id) do
    with {:ok, article} <- Query.load_article(article_id),
         {:ok, member} <- LeaveMember.execute(article, revision, actor, command_id) do
      Query.present_member(member)
    end
  end

  defp resolve_subject_user_id(nil, :apply, actor), do: {:ok, actor.id}

  defp resolve_subject_user_id(login, :invite, _actor) when is_binary(login) do
    case Accounts.front_desk_user(String.trim(login), mode: :internal) do
      {:ok, %User{id: user_id}} -> {:ok, user_id}
      _ -> {:error, :invalid_request_subject}
    end
  end

  defp resolve_subject_user_id(_, _, _), do: {:error, :invalid_request_subject}

  defp approved_permissions(
         %ArticleCoAuthorRequest{type: :invite, proposed_permissions: proposed},
         :accept,
         nil
       ) do
    {:ok, proposed}
  end

  defp approved_permissions(_request, :accept, permissions) when is_map(permissions) do
    {:ok, permissions}
  end

  defp approved_permissions(_request, :reject, _permissions), do: {:ok, nil}
  defp approved_permissions(_, _, _), do: {:error, :invalid_request_approval}

  defp present_current_member(%ArticleCoAuthor{} = member) do
    case Query.present_member(member) do
      {:ok, presented} -> presented
      _ -> nil
    end
  end

  defp present_current_member(_), do: nil
end
