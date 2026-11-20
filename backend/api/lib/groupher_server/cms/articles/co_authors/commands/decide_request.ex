defmodule GroupherServer.CMS.Articles.CoAuthors.Commands.DecideRequest do
  @moduledoc """
  Accepts or rejects a locked Article co-author request at its expected revision.

      Receipt -> Article / User / request locks -> grant/member + decision + Notice intent
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.CoAuthors.{Effects, Locks}
  alias CMS.Articles.CoAuthors.Requests, as: Rules
  alias CMS.Model.{Article, ArticleCoAuthor, ArticleCoAuthorRequest, Author}
  alias CMS.Passport.Scope.ArticleGrant

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation for a request decision; the request key lets presentation reload the current request and membership.

        decided request + member transition -> request_id + command_id -> Receipt replay -> current request/member result
    """
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :article_co_author_request_decide,
      data_keys: ["request_id", "command_id"],
      field_types: %{"request_id" => :string, "command_id" => :string}
  end

  @pipeline operation: :article_co_author_request_decide,
            confirmation: Confirmation,
            target: :article,
            params: [:request_id, :revision, :decision, :approved]
  receipt_pipeline run(article, request_id, revision, decision, approved, actor, command_id) do
    gate(fn candidate -> authorize_request(candidate, request_id, actor) end)

    change(fn canonical, operation_ref ->
      decide_locked(canonical, request_id, revision, decision, approved, actor, operation_ref)
    end)

    confirm(fn {request, _member} ->
      {:ok,
       %Confirmation{
         data: %{"request_id" => request.id, "command_id" => command_id}
       }}
    end)

    present(fn %Confirmation{data: %{"request_id" => id}} ->
      case Repo.get(ArticleCoAuthorRequest, id) do
        %ArticleCoAuthorRequest{} = request ->
          current_member = current_member_for_user(request.article_id, request.subject_user_id)
          {:ok, {request, current_member}}

        nil ->
          {:error, CMS.ErrorCat.command_result_unavailable()}
      end
    end)
  end

  @doc "Decides a pending invite or application at its expected request revision."
  def execute(
        %Article{} = article,
        request_id,
        revision,
        decision,
        approved,
        %User{} = actor,
        command_id
      )
      when is_binary(request_id) and is_integer(revision) and revision > 0 and
             decision in [:accept, :reject] and is_binary(command_id) do
    if (decision == :accept and is_map(approved)) or (decision == :reject and is_nil(approved)) do
      run(article, request_id, revision, decision, approved, actor, command_id)
    else
      {:error, :invalid_request_approval}
    end
  end

  def execute(_, _, _, _, _, _, _), do: {:error, :invalid_article_co_author_request}

  defp authorize_request(article, request_id, actor) do
    case Repo.get_by(ArticleCoAuthorRequest, id: request_id, article_id: article.id) do
      %ArticleCoAuthorRequest{type: :invite, subject_user_id: subject_id}
      when subject_id == actor.id ->
        {:ok, article}

      %ArticleCoAuthorRequest{type: :apply} ->
        CMS.Gate.check_in_transaction(actor, :manage_coauthors, article)

      _ ->
        {:error, :request_not_found}
    end
  end

  defp decide_locked(article, request_id, revision, decision, approved, actor, operation) do
    with %ArticleCoAuthorRequest{} = candidate <-
           Repo.get_by(ArticleCoAuthorRequest, id: request_id, article_id: article.id),
         users = Enum.uniq([actor.id, candidate.subject_user_id, candidate.created_by_id]),
         {:ok, locked} <- Locks.lock(article.id, users, [candidate.id]),
         [request] <- locked.requests,
         {:ok, owner} <- owner_user(locked.article),
         {:ok, :pass} <- authorize_decision(request, actor, owner),
         {:ok, result} <-
           decide_or_expire(
             locked,
             request,
             revision,
             decision,
             approved,
             actor,
             owner,
             operation
           ) do
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

  defp authorize_decision(%ArticleCoAuthorRequest{type: :invite} = request, actor, owner) do
    if actor.id == request.subject_user_id and request.created_by_id == owner.id,
      do: {:ok, :pass},
      else: {:error, :permission_denied}
  end

  defp authorize_decision(%ArticleCoAuthorRequest{type: :apply}, actor, owner) do
    if actor.id == owner.id, do: {:ok, :pass}, else: {:error, :permission_denied}
  end

  defp decide_or_expire(locked, request, revision, decision, approved, actor, owner, operation) do
    now = DateTime.utc_now(:second)

    case Rules.pending(request, revision, now) do
      {:ok, :pass} ->
        commit_decision(locked, request, decision, approved, actor, owner, operation, now)

      {:error, :request_expired} ->
        with {:ok, expired} <- expire_request(request, owner, operation) do
          {:ok, {expired, current_member(locked, request.subject_user_id)}}
        end

      {:error, _} = error ->
        error
    end
  end

  defp expire_request(request, owner, operation) do
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
  end

  defp commit_decision(locked, request, decision, approved, actor, owner, operation, now) do
    before_member = current_member(locked, request.subject_user_id)
    before_permissions = if before_member, do: before_member.permissions, else: %{}

    with {:ok, granted} <- approval(request, decision, approved),
         {:ok, {member, member_event}} <- apply_approval(locked, request, decision, granted),
         after_permissions = if(member, do: member.permissions, else: before_permissions),
         {:ok, decided} <-
           request
           |> ArticleCoAuthorRequest.changeset(%{
             status: :decided,
             decision: decision,
             decided_by_id: actor.id,
             decided_at: now,
             approved_permissions: granted,
             revision: request.revision + 1
           })
           |> Repo.update(),
         {:ok, _event} <-
           Effects.record_event(%{
             article_id: request.article_id,
             subject_user_id: request.subject_user_id,
             member_id: if(member, do: member.id, else: if(before_member, do: before_member.id)),
             actor: actor,
             type: :request_decide,
             before_permissions: before_permissions,
             after_permissions: after_permissions,
             request_id: request.id,
             operation_ref: operation,
             operation_index: 0
           }),
         {:ok, :pass} <-
           record_member_event(
             member_event,
             locked.article.id,
             request.subject_user_id,
             actor,
             member,
             before_permissions,
             after_permissions,
             request.id,
             operation
           ),
         recipient <- if(request.type == :invite, do: owner.id, else: request.subject_user_id),
         {:ok, _} <- Effects.request_notice(decided, :decided, actor, [recipient], operation) do
      {:ok, {decided, member}}
    end
  end

  defp approval(request, :accept, approved), do: Rules.approve(request, approved)
  defp approval(_request, :reject, nil), do: {:ok, nil}

  defp apply_approval(locked, request, :reject, nil),
    do: {:ok, {current_member(locked, request.subject_user_id), nil}}

  defp apply_approval(locked, request, :accept, granted) do
    subject = Enum.find(locked.users, &(&1.id == request.subject_user_id))

    with %User{} <- subject,
         {:ok, author} <- CMS.Articles.Persist.ensure_author_exists(subject),
         {:ok, {member, type, before_permissions}} <-
           grant_or_create_member(locked.article, author, subject, granted, locked.members) do
      {:ok, {member, {member, type, before_permissions}}}
    else
      nil -> {:error, :invalid_request_subject}
      {:error, _} = error -> error
    end
  end

  defp grant_or_create_member(article, author, subject, granted, members) do
    case Enum.find(members, &(&1.author_id == author.id)) do
      %ArticleCoAuthor{} = member ->
        scope = %ArticleGrant{subject_id: subject.id, article_id: article.id, member: member}

        with {:ok, updated} <-
               CMS.Passport.grant_in_transaction(subject, scope, granted, member.revision) do
          {:ok, {updated, :grant, member.permissions}}
        end

      nil ->
        with {:ok, created} <-
               %ArticleCoAuthor{}
               |> ArticleCoAuthor.changeset(%{
                 article_id: article.id,
                 author_id: author.id,
                 permissions: granted,
                 revision: 1,
                 joined_at: DateTime.utc_now(:second)
               })
               |> Repo.insert() do
          {:ok, {created, :join, %{}}}
        end
    end
  end

  defp current_member(locked, user_id) do
    author_ids = for author <- locked.authors, author.user_id == user_id, do: author.id
    Enum.find(locked.members, &(&1.author_id in author_ids))
  end

  defp current_member_for_user(article_id, user_id) do
    case Repo.get_by(Author, user_id: user_id) do
      %Author{id: author_id} ->
        Repo.get_by(ArticleCoAuthor, article_id: article_id, author_id: author_id)

      nil ->
        nil
    end
  end

  defp record_member_event(
         nil,
         _article_id,
         _subject_id,
         _actor,
         _member,
         _before,
         _after,
         _request,
         _operation
       ),
       do: {:ok, :pass}

  defp record_member_event(
         {member, type, before_permissions},
         article_id,
         subject_id,
         actor,
         _unused_member,
         _unused_before,
         after_permissions,
         request_id,
         operation
       ) do
    case Effects.record_event(%{
           article_id: article_id,
           subject_user_id: subject_id,
           member_id: member.id,
           actor: actor,
           type: type,
           before_permissions: before_permissions,
           after_permissions: after_permissions,
           request_id: request_id,
           operation_ref: operation,
           operation_index: 1
         }) do
      {:ok, _event} -> {:ok, :pass}
      {:error, _} = error -> error
    end
  end
end
