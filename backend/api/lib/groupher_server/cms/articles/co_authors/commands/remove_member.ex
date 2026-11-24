defmodule GroupherServer.CMS.Articles.CoAuthors.Commands.RemoveMember do
  @moduledoc """
  Removes one Article membership and cancels its pending requests atomically.

      Receipt -> Article / User / member / request locks -> audit + Notice intents
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.CoAuthors.{Effects, Locks}
  alias CMS.Model.{Article, ArticleCoAuthor, ArticleCoAuthorRequest, Author}

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation stores the removed membership snapshot because its row no longer exists after commit.

        committed removal -> member identity snapshot -> Receipt replay -> removed member result
    """
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :article_co_author_member_remove,
      data_keys: [
        "article_id",
        "author_id",
        "joined_at",
        "member_id",
        "permissions",
        "revision",
        "user_id"
      ],
      field_types: %{
        "article_id" => :string,
        "author_id" => :integer,
        "joined_at" => :string,
        "member_id" => :string,
        "permissions" => :json,
        "revision" => :integer,
        "user_id" => :integer
      }
  end

  @pipeline operation: :article_co_author_member_remove,
            confirmation: Confirmation,
            target: :article,
            params: [:member_id, :revision]
  receipt_pipeline run(article, member_id, revision, actor, command_id) do
    gate(fn canonical -> authorize_member(canonical, member_id, actor, :remove) end)

    change(fn canonical, operation ->
      remove_locked(canonical, member_id, revision, actor, operation, :remove)
    end)

    confirm(&confirmation/1)
    present(&present_result/1)
  end

  @doc "Removes one current member when the actor manages the Article."
  def execute(%Article{} = article, member_id, revision, %User{} = actor, command_id)
      when is_binary(member_id) and is_integer(revision) and revision > 0 and
             is_binary(command_id) do
    run(article, member_id, revision, actor, command_id)
  end

  def execute(_, _, _, _, _), do: {:error, :invalid_article_co_author_removal}

  @doc "Authorizes a member removal or self-leave against the Article's current membership and manager rules."
  def authorize_member(article, member_id, actor, mode) do
    with %ArticleCoAuthor{} = member <-
           Repo.get_by(ArticleCoAuthor, id: member_id, article_id: article.id),
         {:ok, %Author{user_id: subject_id}} <- author(member.author_id),
         {:ok, %Author{user_id: owner_id}} <- author(article.author_id) do
      if mode in [:remove, :leave] and actor.id == subject_id and
           (mode == :remove or subject_id != owner_id) do
        {:ok, article}
      else
        CMS.Gate.check_in_transaction(actor, :manage_coauthors, article)
      end
    else
      _ -> {:error, :article_co_author_not_found}
    end
  end

  @doc "Removes the revision-matched member, cancels that subject's pending requests, and records the audit effects in the caller transaction."
  def remove_locked(article, member_id, revision, actor, operation, mode) do
    with %ArticleCoAuthor{} = candidate <-
           Repo.get_by(ArticleCoAuthor, id: member_id, article_id: article.id),
         {:ok, %Author{user_id: subject_id}} <- author(candidate.author_id),
         {:ok, %Author{user_id: owner_id}} <- author(article.author_id),
         {:ok, locked} <- Locks.lock(article.id, Enum.uniq([actor.id, subject_id, owner_id])),
         %ArticleCoAuthor{} = member <- Enum.find(locked.members, &(&1.id == member_id)),
         true <- member.revision == revision,
         {:ok, :pass} <- may_remove(locked.article, member, actor, mode),
         {:ok, _deleted} <- Repo.delete(member),
         {:ok, :pass} <- cancel_pending(locked, subject_id, actor, operation),
         {:ok, _event} <-
           Effects.record_event(%{
             article_id: member.article_id,
             subject_user_id: subject_id,
             member_id: member.id,
             actor: actor,
             type: if(mode == :leave, do: :exit, else: :remove),
             before_permissions: member.permissions,
             after_permissions: %{},
             operation_ref: operation,
             operation_index: length(Enum.filter(locked.requests, &(&1.status == :pending)))
           }) do
      {:ok, member}
    else
      nil -> {:error, :article_co_author_not_found}
      false -> {:error, :permission_revision_conflict}
      {:error, _} = error -> error
      _ -> {:error, :invalid_article_co_author_removal}
    end
  end

  defp may_remove(_article, _member, _actor, :remove), do: {:ok, :pass}

  defp may_remove(article, member, actor, :leave) do
    with {:ok, %Author{user_id: subject_id}} <- author(member.author_id),
         {:ok, %Author{user_id: owner_id}} <- author(article.author_id) do
      cond do
        subject_id != actor.id -> {:error, :permission_denied}
        subject_id == owner_id -> {:error, :article_owner_cannot_leave}
        true -> {:ok, :pass}
      end
    end
  end

  defp cancel_pending(locked, subject_id, actor, operation) do
    requests =
      Enum.filter(locked.requests, &(&1.status == :pending and &1.subject_user_id == subject_id))

    requests
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, :pass}, fn {request, index}, _acc ->
      now = DateTime.utc_now(:second)

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
               operation_index: index
             }),
           {:ok, _} <-
             Effects.request_notice(
               cancelled,
               :cancelled,
               actor,
               [
                 if(actor.id == request.subject_user_id,
                   do: request.created_by_id,
                   else: request.subject_user_id
                 )
               ],
               operation
             ) do
        {:cont, {:ok, :pass}}
      else
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp author(author_id) do
    case Repo.get(Author, author_id) do
      %Author{} = author -> {:ok, author}
      nil -> {:error, :article_co_author_not_found}
    end
  end

  defp confirmation(member) do
    {:ok,
     %Confirmation{
       data: %{
         "article_id" => member.article_id,
         "author_id" => member.author_id,
         "joined_at" => DateTime.to_iso8601(member.joined_at),
         "member_id" => member.id,
         "permissions" => member.permissions,
         "revision" => member.revision,
         "user_id" => Repo.get!(Author, member.author_id).user_id
       }
     }}
  end

  defp present_result(%Confirmation{data: data}) do
    {:ok,
     %ArticleCoAuthor{
       id: data["member_id"],
       article_id: data["article_id"],
       author_id: data["author_id"],
       joined_at: DateTime.from_iso8601(data["joined_at"]) |> elem(1),
       permissions: data["permissions"],
       revision: data["revision"]
     }}
  end
end
