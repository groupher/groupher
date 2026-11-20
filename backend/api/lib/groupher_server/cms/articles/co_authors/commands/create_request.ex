defmodule GroupherServer.CMS.Articles.CoAuthors.Commands.CreateRequest do
  @moduledoc """
  Creates an immutable Article co-author invite or application with a Receipt.

      Article lock -> identity / visibility checks -> pending request -> Notice Outbox
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.CoAuthors.{Effects, Locks}
  alias CMS.Articles.CoAuthors.Requests, as: Rules

  alias CMS.Model.{
    Article,
    ArticleCoAuthorRequest,
    Author
  }

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation for one immutable Article co-author request.

        committed request -> request_id + command_id -> Receipt replay -> canonical request read
    """
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :article_co_author_request_create,
      data_keys: ["request_id", "command_id"],
      field_types: %{"request_id" => :string, "command_id" => :string}
  end

  @pipeline operation: :article_co_author_request_create,
            confirmation: Confirmation,
            target: :article,
            params: [:subject_user_id, :request_type, :permissions]
  receipt_pipeline run(article, subject_user_id, request_type, permissions, actor, command_id) do
    gate(fn candidate -> authorize_create(candidate, subject_user_id, request_type, actor) end)

    change(fn canonical, operation_ref ->
      create_locked(canonical, subject_user_id, request_type, permissions, actor, operation_ref)
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

  @doc "Creates an invite or apply request for one Article and stable User identity."
  def execute(%Article{} = article, subject, type, permissions, %User{} = actor, command_id)
      when is_binary(command_id) and type in [:invite, :apply] and is_map(permissions) do
    with {:ok, subject_id} <- subject_id(subject),
         true <- type != :apply or subject_id == actor.id do
      run(article, subject_id, type, permissions, actor, command_id)
    else
      false -> {:error, :invalid_request_subject}
      {:error, _} = error -> error
    end
  end

  def execute(_, _, _, _, _, _), do: {:error, :invalid_article_co_author_request}

  defp authorize_create(article, _subject_id, :apply, _actor), do: {:ok, article}

  defp authorize_create(article, _subject_id, :invite, actor) do
    CMS.Gate.check_in_transaction(actor, :manage_coauthors, article)
  end

  defp create_locked(article, subject_id, type, permissions, actor, operation_ref) do
    with {:ok, proposal} <- Rules.proposal(permissions),
         {:ok, locked} <- Locks.lock(article.id, [actor.id, subject_id]),
         {:ok, owner} <- owner_user(locked.article),
         {:ok, :pass} <- validate_subject(locked, subject_id, actor, type, owner),
         pending <- Enum.find(locked.requests, &(&1.subject_user_id == subject_id)),
         {:ok, {current, next_event_index}} <-
           expire_pending(locked, pending, owner, actor, operation_ref),
         {:ok, request} <- create_or_existing(locked, current, subject_id, type, proposal, actor),
         {:ok, :pass} <-
           maybe_enqueue_created(
             request,
             current,
             owner,
             actor,
             operation_ref,
             next_event_index
           ) do
      {:ok, request}
    end
  end

  defp owner_user(%Article{author_id: author_id}) do
    case Repo.get(Author, author_id) do
      %Author{user_id: id} when is_integer(id) ->
        case Repo.get(User, id) do
          %User{} = user -> {:ok, user}
          nil -> {:error, :article_owner_not_found}
        end

      _ ->
        {:error, :article_owner_not_found}
    end
  end

  defp validate_subject(locked, subject_id, actor, :invite, %User{id: owner_id}) do
    cond do
      owner_id != actor.id ->
        {:error, :permission_denied}

      actor.id == subject_id ->
        {:error, :article_owner_cannot_join}

      Enum.any?(locked.members, &(&1.author_id in author_ids(locked, subject_id))) ->
        {:error, :already_article_co_author}

      true ->
        {:ok, :pass}
    end
  end

  defp validate_subject(locked, subject_id, actor, :apply, %User{id: owner_id}) do
    member? = Enum.any?(locked.members, &(&1.author_id in author_ids(locked, subject_id)))

    cond do
      actor.id != subject_id ->
        {:error, :invalid_request_subject}

      subject_id == owner_id ->
        {:error, :article_owner_cannot_join}

      member? ->
        {:ok, :pass}

      public_article?(locked.article) ->
        {:ok, :pass}

      true ->
        {:error, :article_not_found}
    end
  end

  defp author_ids(locked, subject_id) do
    for author <- locked.authors, author.user_id == subject_id, do: author.id
  end

  defp public_article?(%Article{thread: :doc} = article) do
    public_scope?(article, CMS.Gate.Context.Scope.Doc.public())
  end

  defp public_article?(%Article{} = article) do
    public_scope?(article, CMS.Gate.Context.Scope.Article.public(article.thread))
  end

  defp public_scope?(article, context) do
    case CMS.Gate.scope(Article, nil, :list, context) do
      %Ecto.Query{} = query ->
        Repo.exists?(from(candidate in query, where: candidate.id == ^article.id))

      _ ->
        false
    end
  end

  defp expire_pending(_locked, nil, _owner, _actor, _operation), do: {:ok, {nil, 0}}

  defp expire_pending(_locked, request, owner, _actor, operation) do
    now = DateTime.utc_now(:second)

    case Rules.pending(request, request.revision, now) do
      {:ok, :pass} ->
        {:ok, {request, 0}}

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
          {:ok, {nil, 1}}
        end

      {:error, _} = error ->
        error
    end
  end

  defp create_or_existing(
         _locked,
         %ArticleCoAuthorRequest{} = request,
         _subject,
         _type,
         _proposal,
         _actor
       ),
       do: {:ok, request}

  defp create_or_existing(locked, nil, subject_id, type, proposal, actor) do
    attrs = %{
      article_id: locked.article.id,
      subject_user_id: subject_id,
      created_by_id: actor.id,
      type: type,
      proposed_permissions: proposal,
      expires_at: DateTime.add(DateTime.utc_now(:second), 604_800)
    }

    %ArticleCoAuthorRequest{}
    |> ArticleCoAuthorRequest.changeset(attrs)
    |> Repo.insert()
  end

  defp maybe_enqueue_created(
         _request,
         %ArticleCoAuthorRequest{},
         _owner,
         _actor,
         _operation,
         _event_index
       ),
       do: {:ok, :pass}

  defp maybe_enqueue_created(request, nil, owner, actor, operation, event_index) do
    recipient = if request.type == :invite, do: request.subject_user_id, else: owner.id

    with {:ok, _event} <-
           Effects.record_event(%{
             article_id: request.article_id,
             subject_user_id: request.subject_user_id,
             member_id: nil,
             actor: actor,
             type: :request_create,
             before_permissions: %{},
             after_permissions: %{},
             request_id: request.id,
             operation_ref: operation,
             operation_index: event_index
           }),
         {:ok, _intents} <-
           Effects.request_notice(request, :created, actor, [recipient], operation) do
      {:ok, :pass}
    end
  end

  defp subject_id(%User{id: id}) when is_integer(id), do: {:ok, id}
  defp subject_id(id) when is_integer(id) and id > 0, do: {:ok, id}
  defp subject_id(_), do: {:error, :invalid_request_subject}
end
