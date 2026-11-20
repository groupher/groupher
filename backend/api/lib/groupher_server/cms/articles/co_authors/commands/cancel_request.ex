defmodule GroupherServer.CMS.Articles.CoAuthors.Commands.CancelRequest do
  @moduledoc """
  Cancels a pending Article co-author request at its expected revision.

      Receipt -> Article / User / request locks -> terminal state + Notice intent
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.CoAuthors.{Effects, Locks}
  alias CMS.Articles.CoAuthors.Requests, as: Rules
  alias CMS.Model.{Article, ArticleCoAuthorRequest, Author}

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation for a cancelled or expired Article co-author request.

        terminal request -> request_id + command_id -> Receipt replay -> canonical request read
    """
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :article_co_author_request_cancel,
      data_keys: ["request_id", "command_id"],
      field_types: %{"request_id" => :string, "command_id" => :string}
  end

  @pipeline operation: :article_co_author_request_cancel,
            confirmation: Confirmation,
            target: :article,
            params: [:request_id, :revision]
  receipt_pipeline run(article, request_id, revision, actor, command_id) do
    gate(fn candidate -> authorize_cancel(candidate, request_id, actor) end)

    change(fn canonical, operation_ref ->
      cancel_locked(canonical, request_id, revision, actor, operation_ref)
    end)

    confirm(fn request ->
      {:ok,
       %Confirmation{
         data: %{"request_id" => request.id, "command_id" => command_id}
       }}
    end)

    present(fn %Confirmation{data: %{"request_id" => id}} ->
      case Repo.get(ArticleCoAuthorRequest, id) do
        %ArticleCoAuthorRequest{} = request -> {:ok, request}
        nil -> {:error, CMS.ErrorCat.command_result_unavailable()}
      end
    end)
  end

  @doc "Cancels a pending request by its initiator, subject, or current Article manager."
  def execute(%Article{} = article, request_id, revision, %User{} = actor, command_id)
      when is_binary(request_id) and is_integer(revision) and revision > 0 and
             is_binary(command_id),
      do: run(article, request_id, revision, actor, command_id)

  def execute(_, _, _, _, _), do: {:error, :invalid_article_co_author_request}

  defp authorize_cancel(article, request_id, actor) do
    case Repo.get_by(ArticleCoAuthorRequest, id: request_id, article_id: article.id) do
      %ArticleCoAuthorRequest{subject_user_id: id} when id == actor.id ->
        {:ok, article}

      %ArticleCoAuthorRequest{created_by_id: id} when id == actor.id ->
        {:ok, article}

      %ArticleCoAuthorRequest{} ->
        CMS.Gate.check_in_transaction(actor, :manage_coauthors, article)

      _ ->
        {:error, :request_not_found}
    end
  end

  defp cancel_locked(article, request_id, revision, actor, operation) do
    with %ArticleCoAuthorRequest{} = candidate <-
           Repo.get_by(ArticleCoAuthorRequest, id: request_id, article_id: article.id),
         user_ids = Enum.uniq([actor.id, candidate.subject_user_id, candidate.created_by_id]),
         {:ok, locked} <- Locks.lock(article.id, user_ids, [candidate.id]),
         [request] <- locked.requests,
         {:ok, owner} <- owner_user(locked.article),
         {:ok, :pass} <- authorize_cancel_locked(request, actor, owner),
         {:ok, result} <- cancel_or_expire(request, revision, actor, owner, operation) do
      {:ok, result}
    else
      nil -> {:error, :request_not_found}
      {:error, _} = error -> error
      _ -> {:error, :invalid_article_co_author_request}
    end
  end

  defp owner_user(%Article{author_id: author_id}) do
    case Repo.get(Author, author_id) do
      %Author{user_id: id} when is_integer(id) ->
        case Repo.get(User, id) do
          %User{} = owner -> {:ok, owner}
          nil -> {:error, :article_owner_not_found}
        end

      _ ->
        {:error, :article_owner_not_found}
    end
  end

  defp authorize_cancel_locked(request, actor, owner) do
    if actor.id in [request.subject_user_id, request.created_by_id, owner.id],
      do: {:ok, :pass},
      else: {:error, :permission_denied}
  end

  defp cancel_or_expire(request, revision, actor, owner, operation) do
    now = DateTime.utc_now(:second)

    case Rules.pending(request, revision, now) do
      {:ok, :pass} ->
        with {:ok, cancelled} <-
               request
               |> ArticleCoAuthorRequest.changeset(%{
                 status: :cancelled,
                 cancelled_by_id: actor.id,
                 cancelled_at: now,
                 revision: request.revision + 1
               })
               |> Repo.update(),
             {:ok, _event} <-
               Effects.record_event(%{
                 article_id: cancelled.article_id,
                 subject_user_id: cancelled.subject_user_id,
                 member_id: nil,
                 actor: actor,
                 type: :request_cancel,
                 before_permissions: %{},
                 after_permissions: %{},
                 request_id: cancelled.id,
                 operation_ref: operation,
                 operation_index: 0
               }),
             {:ok, _} <-
               Effects.request_notice(
                 cancelled,
                 :cancelled,
                 actor,
                 [other_party(cancelled, actor, owner)],
                 operation
               ) do
          {:ok, cancelled}
        end

      {:error, :request_expired} ->
        with {:ok, expired} <-
               request
               |> ArticleCoAuthorRequest.changeset(%{
                 status: :expired,
                 revision: request.revision + 1
               })
               |> Repo.update(),
             {:ok, _event} <-
               Effects.record_event(%{
                 article_id: expired.article_id,
                 subject_user_id: expired.subject_user_id,
                 member_id: nil,
                 actor: :system,
                 type: :request_expire,
                 before_permissions: %{},
                 after_permissions: %{},
                 request_id: expired.id,
                 operation_ref: operation,
                 operation_index: 0
               }),
             {:ok, _} <-
               Effects.request_notice(
                 expired,
                 :expired,
                 :system,
                 Enum.uniq([expired.subject_user_id, owner.id]),
                 operation
               ) do
          {:ok, expired}
        end

      {:error, _} = error ->
        error
    end
  end

  defp other_party(%ArticleCoAuthorRequest{type: :invite} = request, actor, owner) do
    if actor.id == request.subject_user_id, do: owner.id, else: request.subject_user_id
  end

  defp other_party(%ArticleCoAuthorRequest{type: :apply} = request, actor, owner) do
    if actor.id == request.subject_user_id, do: owner.id, else: request.subject_user_id
  end
end
