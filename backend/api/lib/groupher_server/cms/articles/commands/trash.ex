defmodule GroupherServer.CMS.Articles.Commands.Trash do
  @moduledoc """
  Moves one stable Article into Trash through the optional command receipt boundary.

      CMS.Articles.trash
        -> Trash.execute
        -> CMS.Command when command_id exists -> Articles.Trash aggregate
  """

  alias GroupherServer.{Accounts, Activity, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.Trash, as: TrashAgg
  alias CMS.Command
  alias CMS.Model.TrashedArticle
  alias CMS.Articles.Commands.TrashConfirmation

  @spec execute(map(), User.t() | nil, keyword()) ::
          {:ok, TrashedArticle.t()} | {:error, term()}
  def execute(article, %User{} = actor, opts) do
    command_id = Keyword.get(opts, :command_id)

    if is_nil(command_id) do
      TrashAgg.trash(article, actor, opts)
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
        |> present_confirmation()

      audit_denial(result, article, actor, command_id, opts)
    end
  end

  def execute(article, actor, opts), do: TrashAgg.trash(article, actor, opts)

  defp trash_action(%{actor: actor, target: article, params: params, command_id: command_id}) do
    with {:ok, item} <- TrashAgg.trash(article, actor, Map.to_list(params)) do
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

  defp audit_denial({:error, %{reason: reason}} = result, article, actor, command_id, opts) do
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

  defp audit_denial(result, _article, _actor, _command_id, _opts), do: result

  defp present_confirmation({:ok, %TrashConfirmation{data: %{"trash_id" => trash_id}}}) do
    TrashAgg.get(trash_id)
  end

  defp present_confirmation(error), do: error
  defp canonical_opts(opts), do: opts |> Keyword.delete(:command_id) |> Map.new()
end
