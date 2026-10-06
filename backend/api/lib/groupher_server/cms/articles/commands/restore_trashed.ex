defmodule GroupherServer.CMS.Articles.Commands.RestoreTrashed do
  @moduledoc """
  Restores one Article Trash membership through the optional command receipt boundary.

      CMS.Articles.restore_trashed
        -> RestoreTrashed.execute
        -> CMS.Command when command_id exists -> Articles.Trash aggregate
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.ErrorCat, as: ArticlesErrorCat
  alias CMS.Articles.Trash, as: TrashAgg
  alias CMS.Command
  alias CMS.FrontDesk
  alias CMS.Model.{Article, TrashedArticle, TrashedDocArticle}
  alias CMS.Articles.Commands.TrashRestoreConfirmation, as: Confirmation

  @spec execute(
          Ecto.UUID.t() | TrashedArticle.t() | TrashedDocArticle.t(),
          User.t() | nil,
          keyword()
        ) :: {:ok, term()} | {:error, term()}
  def execute(%TrashedDocArticle{} = item, actor, opts), do: TrashAgg.restore(item, actor, opts)

  def execute(item_or_id, %User{} = actor, opts) do
    case Keyword.get(opts, :command_id) do
      nil -> restore_now(item_or_id, actor, opts)
      command_id -> execute_command(item_or_id, actor, command_id, opts)
    end
  end

  def execute(item_or_id, actor, opts), do: TrashAgg.restore(item_or_id, actor, opts)

  defp restore_now(item_or_id, actor, opts) do
    with {:ok, item} <- resolve_item(item_or_id) do
      TrashAgg.restore(item, actor, opts)
    end
  end

  defp execute_command(item_or_id, actor, command_id, opts) do
    with {:ok, community_id} <- command_community_id(opts) do
      case resolve_item(item_or_id) do
        {:ok, item} ->
          with :ok <- ensure_community(item, community_id) do
            restore_command(item, actor, command_id, community_id, opts)
            |> present_confirmation()
          end

        {:error, _reason} ->
          %Command{
            actor: actor,
            command_id: command_id,
            operation: :article_restore,
            target: {:article_trash, community_id},
            params: %{item_id: item_or_id, opts: canonical_opts(opts)}
          }
          |> Command.execute(
            action: fn _command ->
              {:error, ArticlesErrorCat.article_not_found("trash item not found")}
            end,
            confirmation: Confirmation
          )
          |> present_confirmation()
      end
    end
  end

  defp restore_command(item, actor, command_id, community_id, opts) do
    %Command{
      actor: actor,
      command_id: command_id,
      operation: :article_restore,
      target: {:article_trash, community_id},
      params: %{item_id: item.hash_id, opts: canonical_opts(opts)}
    }
    |> Command.execute(
      action: fn %{params: %{opts: input}} ->
        with {:ok, article} <- TrashAgg.restore(item, actor, Map.to_list(input)) do
          {:ok, %Confirmation{data: %{"article_id" => article.id, "command_id" => command_id}}}
        end
      end,
      confirmation: Confirmation
    )
  end

  defp resolve_item(%TrashedArticle{} = item), do: {:ok, item}
  defp resolve_item(item_id), do: TrashAgg.get(item_id)

  defp present_confirmation({:ok, %Confirmation{data: %{"article_id" => article_id}}}) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _reason} -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_confirmation(error), do: error
  defp canonical_opts(opts), do: opts |> Keyword.delete(:command_id) |> Map.new()

  defp command_community_id(opts) do
    case Keyword.get(opts, :community_id) do
      community_id when is_integer(community_id) -> {:ok, community_id}
      _ -> {:error, :community_id_required}
    end
  end

  defp ensure_community(%{community_id: community_id}, community_id), do: :ok
  defp ensure_community(_item, _community_id), do: {:error, :community_mismatch}
end
