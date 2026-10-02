defmodule GroupherServer.CMS.Articles.Commands.Trash do
  @moduledoc """
  Runs retry-safe stable Article Trash, restore, and permanent-delete commands.

  Command receipts retain only an opaque Trash id or stable Article UUID; they
  never recover through a retired physical Draft/Public row.

      caller -> Command receipt -> Gate + Trash aggregate -> canonical result
  """

  alias GroupherServer.{Accounts, Activity, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.Trash
  alias CMS.Command
  alias CMS.Model.{Article, TrashedArticle, TrashedDocArticle}

  @doc "Moves one stable Article into Trash under an idempotent command id."
  @spec trash(map(), User.t() | nil, keyword()) :: {:ok, TrashedArticle.t()} | {:error, term()}
  def trash(article, %User{} = actor, opts) do
    command_id = Keyword.get(opts, :command_id)

    if is_nil(command_id) do
      Trash.trash(article, actor, opts)
    else
      result =
        %Command{
          actor: actor,
          command_id: command_id,
          operation: :article_trash,
          target: article,
          params: Keyword.delete(opts, :command_id)
        }
        |> Command.execute(
          action: &trash_action/1,
          result: fn receipt -> Trash.get(receipt.result_key) end
        )

      audit_trash_denial(result, article, actor, command_id, opts)
    end
  end

  def trash(article, actor, opts), do: Trash.trash(article, actor, opts)

  defp trash_action(%{actor: actor, target: article, params: params}) do
    with {:ok, item} <- Trash.trash(article, actor, params) do
      {:ok, item, %{result_key: item.hash_id}}
    end
  end

  @doc "Restores one Trash membership under an idempotent command id."
  @spec restore(
          Ecto.UUID.t() | TrashedArticle.t() | TrashedDocArticle.t(),
          User.t() | nil,
          keyword()
        ) ::
          {:ok, term()} | {:error, term()}
  def restore(%TrashedDocArticle{} = item, actor, opts), do: Trash.restore(item, actor, opts)

  def restore(item_or_id, %User{} = actor, opts) do
    command_id = Keyword.get(opts, :command_id)

    if is_nil(command_id) do
      with {:ok, item} <- resolve_item(item_or_id) do
        Trash.restore(item, actor, opts)
      end
    else
      case resolve_item(item_or_id) do
        {:ok, item} ->
          restore_command(item, actor, command_id, opts)

        {:error, _reason} ->
          %Command{
            actor: actor,
            command_id: command_id,
            operation: :article_restore,
            target: {:article_trash, Keyword.get(opts, :community_id)},
            params: %{item_id: item_or_id, opts: Keyword.delete(opts, :command_id)}
          }
          |> Command.execute(
            action: fn _command ->
              {:error, CMS.Articles.ErrorCat.article_not_found("trash item not found")}
            end,
            result: &recover_article/1
          )
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
    command_id = Keyword.get(opts, :command_id)

    if is_nil(command_id) do
      with {:ok, item} <- resolve_item(item_or_id) do
        Trash.permanently_delete(item, actor, opts)
      end
    else
      case resolve_item(item_or_id) do
        {:ok, item} ->
          permanently_delete_command(item, actor, command_id, opts)

        {:error, _reason} ->
          %Command{
            actor: actor,
            command_id: command_id,
            operation: :article_permanently_delete,
            target: {:article_trash, Keyword.get(opts, :community_id)},
            params: %{item_id: item_or_id, opts: Keyword.delete(opts, :command_id)}
          }
          |> Command.execute(
            action: fn _command ->
              {:error, CMS.Articles.ErrorCat.article_not_found("trash item not found")}
            end,
            result: fn _receipt -> {:ok, %{done: true}} end
          )
      end
    end
  end

  def permanently_delete(item_or_id, actor, opts),
    do: Trash.permanently_delete(item_or_id, actor, opts)

  defp resolve_item(%TrashedArticle{} = item), do: {:ok, item}
  defp resolve_item(item_id), do: Trash.get(item_id)

  defp restore_command(item, actor, command_id, opts) do
    %Command{
      actor: actor,
      command_id: command_id,
      operation: :article_restore,
      target: {:article_trash, item.community_id},
      params: %{item_id: item.hash_id, opts: Keyword.delete(opts, :command_id)}
    }
    |> Command.execute(
      action: fn %{params: %{opts: input}} ->
        with {:ok, article} <- Trash.restore(item, actor, input) do
          {:ok, article, %{result_key: article.id}}
        end
      end,
      result: &recover_article/1
    )
  end

  defp permanently_delete_command(item, actor, command_id, opts) do
    %Command{
      actor: actor,
      command_id: command_id,
      operation: :article_permanently_delete,
      target: {:article_trash, item.community_id},
      params: %{item_id: item.hash_id, opts: Keyword.delete(opts, :command_id)}
    }
    |> Command.execute(
      action: fn %{params: %{opts: input}} -> Trash.permanently_delete(item, actor, input) end,
      result: fn _receipt -> {:ok, %{done: true}} end
    )
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
    case CMS.Articles.Reader.article(article_id) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _reason} -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
    end
  end
end
