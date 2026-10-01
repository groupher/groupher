defmodule GroupherServer.CMS.Articles.Commands.Trash do
  @moduledoc """
  Runs retry-safe stable Article Trash, restore, and permanent-delete commands.

  Command receipts retain only an opaque Trash id or stable Article UUID; they
  never recover through a retired physical Draft/Public row.

      caller -> Command receipt -> Gate + Trash aggregate -> canonical result
  """

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.Trash
  alias CMS.Command
  alias CMS.Model.{Article, TrashedArticle, TrashedDocArticle}

  @doc "Moves one stable Article into Trash under an idempotent command id."
  @spec trash(map(), User.t() | nil, keyword()) :: {:ok, TrashedArticle.t()} | {:error, term()}
  def trash(article, %User{} = actor, opts) do
    with {:ok, command_id} <- Command.resolve_command_id(Keyword.get(opts, :command_id)) do
      result =
        Command.update_user(actor, command_id,
          command: :article_trash,
          resource: article,
          input: Keyword.delete(opts, :command_id),
          recovery: fn receipt -> Trash.get(receipt.result_key) end
        )
        |> Command.run(fn %{resource: canonical, input: input} ->
          with {:ok, item} <- Trash.trash(canonical, actor, input) do
            {:ok, item, %{result_key: item.hash_id}}
          end
        end)

      audit_trash_denial(result, article, actor, command_id, opts)
    end
  end

  def trash(article, actor, opts), do: Trash.trash(article, actor, opts)

  @doc "Restores one Trash membership under an idempotent command id."
  @spec restore(
          Ecto.UUID.t() | TrashedArticle.t() | TrashedDocArticle.t(),
          User.t() | nil,
          keyword()
        ) ::
          {:ok, term()} | {:error, term()}
  def restore(%TrashedDocArticle{} = item, actor, opts), do: Trash.restore(item, actor, opts)

  def restore(item_or_id, %User{} = actor, opts) do
    with {:ok, command_id} <- Command.resolve_command_id(Keyword.get(opts, :command_id)) do
      case resolve_item(item_or_id) do
        {:ok, item} ->
          restore_command(item, actor, command_id, opts)

        {:error, _reason} ->
          Command.create_user(actor, command_id,
            command: :article_restore,
            resource: :article_trash,
            owner: Keyword.get(opts, :community_id),
            input: %{item_id: item_or_id, opts: Keyword.delete(opts, :command_id)},
            recovery: &recover_article/1
          )
          |> Command.run(fn _command ->
            {:error, CMS.Articles.ErrorCat.article_not_found("trash item not found")}
          end)
      end
    end
  end

  def restore(item_or_id, actor, opts), do: Trash.restore(item_or_id, actor, opts)

  @doc "Permanently deletes one trashed stable aggregate under an idempotent command id."
  @spec permanently_delete(
          Ecto.UUID.t() | TrashedArticle.t() | TrashedDocArticle.t(),
          User.t() | nil,
          keyword()
        ) :: {:ok, term()} | {:error, term()}
  def permanently_delete(%TrashedDocArticle{} = item, actor, opts),
    do: Trash.permanently_delete(item, actor, opts)

  def permanently_delete(item_or_id, %User{} = actor, opts) do
    with {:ok, command_id} <- Command.resolve_command_id(Keyword.get(opts, :command_id)) do
      case resolve_item(item_or_id) do
        {:ok, item} ->
          permanently_delete_command(item, actor, command_id, opts)

        {:error, _reason} ->
          Command.create_user(actor, command_id,
            command: :article_permanently_delete,
            resource: :article_trash,
            owner: Keyword.get(opts, :community_id),
            input: %{item_id: item_or_id, opts: Keyword.delete(opts, :command_id)},
            recovery: fn _receipt -> {:ok, %{done: true}} end
          )
          |> Command.run(fn _command ->
            {:error, CMS.Articles.ErrorCat.article_not_found("trash item not found")}
          end)
      end
    end
  end

  def permanently_delete(item_or_id, actor, opts),
    do: Trash.permanently_delete(item_or_id, actor, opts)

  defp resolve_item(%TrashedArticle{} = item), do: {:ok, item}
  defp resolve_item(item_id), do: Trash.get(item_id)

  defp restore_command(item, actor, command_id, opts) do
    Command.create_user(actor, command_id,
      command: :article_restore,
      resource: :article_trash,
      owner: item.community_id,
      input: %{item_id: item.hash_id, opts: Keyword.delete(opts, :command_id)},
      recovery: &recover_article/1
    )
    |> Command.run(fn %{input: %{opts: input}} ->
      with {:ok, article} <- Trash.restore(item, actor, input) do
        {:ok, article, %{result_key: article.id}}
      end
    end)
  end

  defp permanently_delete_command(item, actor, command_id, opts) do
    Command.create_user(actor, command_id,
      command: :article_permanently_delete,
      resource: :article_trash,
      owner: item.community_id,
      input: %{item_id: item.hash_id, opts: Keyword.delete(opts, :command_id)},
      recovery: fn _receipt -> {:ok, %{done: true}} end
    )
    |> Command.run(fn %{input: %{opts: input}} ->
      Trash.permanently_delete(item, actor, input)
    end)
  end

  defp audit_trash_denial({:error, %{reason: reason}} = result, article, actor, command_id, opts) do
    case Activity.log(article, :trashed,
           actor: actor,
           source: Keyword.get(opts, :source, :api),
           outcome: :denied,
           denial_code: reason,
           operation_ref: command_id
         ) do
      {:ok, _event} -> result
      {:error, %{reason: :duplicate_event}} -> result
      {:error, _audit_reason} -> result
    end
  end

  defp audit_trash_denial(result, _article, _actor, _command_id, _opts), do: result

  defp recover_article(%{result_key: article_id}) do
    case Repo.get(Article, article_id) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
    end
  end
end
