defmodule GroupherServer.CMS.Articles.Commands.PermanentlyDeleteTrashed do
  @moduledoc """
  Permanently deletes one trashed Article through the optional command receipt boundary.

      CMS.Articles.permanently_delete_trashed
        -> PermanentlyDeleteTrashed.execute
        -> CMS.Command when command_id exists -> Articles.Trash aggregate
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.Trash, as: TrashAgg
  alias CMS.Command
  alias CMS.Model.{TrashedArticle, TrashedDocArticle}
  alias CMS.Articles.Commands.TrashPermanentDeleteConfirmation, as: Confirmation

  @spec execute(
          Ecto.UUID.t() | TrashedArticle.t() | TrashedDocArticle.t(),
          User.t() | nil,
          keyword()
        ) :: {:ok, term()} | {:error, term()}
  def execute(%TrashedDocArticle{} = item, actor, opts) do
    TrashAgg.permanently_delete(item, actor, opts)
  end

  def execute(item_or_id, %User{} = actor, opts) do
    case Keyword.get(opts, :command_id) do
      nil -> delete_now(item_or_id, actor, opts)
      command_id -> execute_command(item_or_id, actor, command_id, opts)
    end
  end

  def execute(item_or_id, actor, opts), do: TrashAgg.permanently_delete(item_or_id, actor, opts)

  defp delete_now(item_or_id, actor, opts) do
    with {:ok, item} <- resolve_item(item_or_id) do
      TrashAgg.permanently_delete(item, actor, opts)
    end
  end

  defp execute_command(item_or_id, actor, command_id, opts) do
    case resolve_item(item_or_id) do
      {:ok, item} ->
        delete_command(item, actor, command_id, opts)
        |> present_confirmation()

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
          confirmation: Confirmation
        )
        |> present_confirmation()
    end
  end

  defp delete_command(item, actor, command_id, opts) do
    %Command{
      actor: actor,
      command_id: command_id,
      operation: :article_permanently_delete,
      target: {:article_trash, item.community_id},
      params: %{item_id: item.hash_id, opts: canonical_opts(opts)}
    }
    |> Command.execute(
      action: fn %{params: %{opts: input}} ->
        with {:ok, _result} <- TrashAgg.permanently_delete(item, actor, Map.to_list(input)) do
          {:ok, %Confirmation{data: %{"done" => true, "command_id" => command_id}}}
        end
      end,
      confirmation: Confirmation
    )
  end

  defp resolve_item(%TrashedArticle{} = item), do: {:ok, item}
  defp resolve_item(item_id), do: TrashAgg.get(item_id)

  defp present_confirmation({:ok, %Confirmation{}}), do: {:ok, %{done: true}}
  defp present_confirmation(error), do: error
  defp canonical_opts(opts), do: opts |> Keyword.delete(:command_id) |> Map.new()
end
