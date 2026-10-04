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
  alias CMS.FrontDesk
  alias CMS.Model.{Article, TrashedArticle, TrashedDocArticle}
  alias CMS.Articles.Commands.TrashPermanentDeleteConfirmation, as: PermanentDeleteConfirmation
  alias CMS.Articles.Commands.TrashRestoreConfirmation, as: RestoreConfirmation
  alias CMS.Articles.Commands.TrashConfirmation

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
          params: canonical_opts(opts)
        }
        |> Command.execute(action: &trash_action/1, confirmation: TrashConfirmation)
        |> present_trash_confirmation()

      audit_trash_denial(result, article, actor, command_id, opts)
    end
  end

  def trash(article, actor, opts), do: Trash.trash(article, actor, opts)

  defp trash_action(%{actor: actor, target: article, params: params, command_id: command_id}) do
    with {:ok, item} <- Trash.trash(article, actor, Map.to_list(params)) do
      {:ok,
       %TrashConfirmation{
         data: %{
           "trash_id" => item.hash_id,
           "article_id" => to_string(item.article_id),
           "command_id" => command_id
         }
       }}
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
          |> present_restore_confirmation()

        {:error, _reason} ->
          %Command{
            actor: actor,
            command_id: command_id,
            operation: :article_restore,
            target: {:article_trash, Keyword.get(opts, :community_id)},
            params: %{item_id: item_or_id, opts: canonical_opts(opts)}
          }
          |> Command.execute(
            action: fn _command ->
              {:error, CMS.Articles.ErrorCat.article_not_found("trash item not found")}
            end,
            confirmation: RestoreConfirmation
          )
          |> present_restore_confirmation()
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
          |> present_permanent_confirmation()

        {:error, _reason} ->
          %Command{
            actor: actor,
            command_id: command_id,
            operation: :article_permanently_delete,
            target: {:article_trash, Keyword.get(opts, :community_id)},
            params: %{item_id: item_or_id, opts: canonical_opts(opts)}
          }
          |> Command.execute(
            action: fn _command ->
              {:error, CMS.Articles.ErrorCat.article_not_found("trash item not found")}
            end,
            confirmation: PermanentDeleteConfirmation
          )
          |> present_permanent_confirmation()
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
      params: %{item_id: item.hash_id, opts: canonical_opts(opts)}
    }
    |> Command.execute(
      action: fn %{params: %{opts: input}} ->
        with {:ok, article} <- Trash.restore(item, actor, Map.to_list(input)) do
          {:ok,
           %RestoreConfirmation{
             data: %{"article_id" => article.id, "command_id" => command_id}
           }}
        end
      end,
      confirmation: RestoreConfirmation
    )
  end

  defp permanently_delete_command(item, actor, command_id, opts) do
    %Command{
      actor: actor,
      command_id: command_id,
      operation: :article_permanently_delete,
      target: {:article_trash, item.community_id},
      params: %{item_id: item.hash_id, opts: canonical_opts(opts)}
    }
    |> Command.execute(
      action: fn %{params: %{opts: input}} ->
        with {:ok, _result} <- Trash.permanently_delete(item, actor, Map.to_list(input)) do
          {:ok, %PermanentDeleteConfirmation{data: %{"done" => true, "command_id" => command_id}}}
        end
      end,
      confirmation: PermanentDeleteConfirmation
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

  defp present_trash_confirmation({:ok, %TrashConfirmation{data: %{"trash_id" => trash_id}}}) do
    Trash.get(trash_id)
  end

  defp present_trash_confirmation(error), do: error

  defp present_restore_confirmation(
         {:ok, %RestoreConfirmation{data: %{"article_id" => article_id}}}
       ) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _reason} -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_restore_confirmation(error), do: error

  defp present_permanent_confirmation({:ok, %PermanentDeleteConfirmation{}}),
    do: {:ok, %{done: true}}

  defp present_permanent_confirmation(error), do: error

  defp canonical_opts(opts) when is_list(opts),
    do: opts |> Keyword.delete(:command_id) |> Map.new()

  defp canonical_opts(opts) when is_map(opts), do: Map.delete(opts, :command_id)
end
