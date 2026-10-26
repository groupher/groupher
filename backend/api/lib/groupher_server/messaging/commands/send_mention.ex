defmodule GroupherServer.Messaging.Commands.SendMention do
  @moduledoc """
  Atomically records eligible Mention deliveries and rebuilds affected mailbox projections.

      SendMention
          -> Gate public-read eligibility
          -> Mentions.Persist
          -> Accounts.mailbox_update_status_many_in_transaction/1
          -> commit -> Accounts.mailbox_invalidate_users/1
  """

  use GroupherServer.CommandPipeline

  import Ecto.Query, only: [where: 3]

  alias GroupherServer.{Accounts, Messaging}
  alias Accounts.Model.User
  alias Messaging.Mentions.Persist
  alias GroupherServer.CMS
  alias CMS.Model.{Article, Comment}

  @pipeline operation: :messaging_send_mention,
            access: :open,
            target: :content,
            params: [:mentions, :from_user]

  direct_pipeline execute_pipeline(content, mentions, from_user) do
    change(fn _content ->
      case mentions do
        [] ->
          {:ok, %{users: []}}

        _ ->
          with {:ok, :pass} <- ensure_public_content(content),
               {:ok, mentions} <- Persist.replace(content, mentions, from_user),
               {:ok, users} <-
                 mentions
                 |> Enum.map(& &1.to_user_id)
                 |> Accounts.mailbox_update_status_many_in_transaction() do
            {:ok, %{users: users}}
          end
      end
    end)

    present(fn %{users: users} ->
      _ = Accounts.mailbox_invalidate_users(users)
      {:ok, :pass}
    end)
  end

  @doc """
  Sends mentions for an article or comment.

  Delivery is denied while the content is hidden by Lifecycle or review
  restrictions. Event retries reuse the target revision identity and do not
  reset an existing inbox row's read state.

  ## Examples

      Messaging.Commands.SendMention.run(comment, mentions, user)
      #=> {:ok, :pass} | {:error, :content_not_public}
  """
  @spec run(struct(), list(), User.t()) :: {:ok, :pass} | {:error, term()}
  def run(content, mentions, %User{} = from_user) do
    execute_pipeline(content, mentions, from_user)
  end

  defp ensure_public_content(%Comment{id: id, thread: :doc}) do
    require_public_read(
      Comment,
      id,
      CMS.gate_context_scope_comment_for_thread(:doc, branch_policy: :main)
    )
  end

  defp ensure_public_content(%Comment{id: id, thread: thread}) do
    require_public_read(Comment, id, CMS.gate_context_scope_comment_for_thread(thread))
  end

  defp ensure_public_content(%{comment_id: id, thread: :doc}) when is_integer(id) do
    ensure_public_content(%Comment{id: id, thread: :doc})
  end

  defp ensure_public_content(%{comment_id: id, thread: thread})
       when is_integer(id) and not is_nil(thread) do
    ensure_public_content(%Comment{id: id, thread: thread})
  end

  defp ensure_public_content(%Article{id: id, thread: :doc}) do
    require_public_read(Article, id, CMS.gate_context_scope_doc_public_main())
  end

  defp ensure_public_content(%Article{id: id, thread: thread}) do
    require_public_read(Article, id, CMS.gate_context_scope_article_public(thread))
  end

  defp ensure_public_content(%{article_id: id, thread: :doc} = article)
       when is_binary(id) do
    context =
      case Map.get(article, :branch_id) do
        branch_id when is_integer(branch_id) ->
          CMS.gate_context_scope_doc_public_branch(branch_id)

        _ ->
          CMS.gate_context_scope_doc_public_main()
      end

    require_public_read(Article, id, context)
  end

  defp ensure_public_content(%{article_id: id, thread: thread})
       when is_binary(id) and not is_nil(thread) do
    require_public_read(Article, id, CMS.gate_context_scope_article_public(thread))
  end

  defp ensure_public_content(_content), do: {:error, :content_not_public}

  defp require_public_read(schema, id, context) do
    case CMS.gate_scope(schema, nil, :read, context) do
      %Ecto.Query{} = query ->
        scoped = where(query, [resource], resource.id == ^id)

        if GroupherServer.Repo.exists?(scoped) do
          {:ok, :pass}
        else
          {:error, :content_not_public}
        end

      _ ->
        {:error, :content_not_public}
    end
  end
end
