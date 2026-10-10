defmodule GroupherServer.CMS.Articles.Commands.Move do
  @moduledoc """
  Moves an ordinary Article from one explicit Community binding to another.

      CMS.Articles.move -> CMS.Command -> Gate -> BindingPersist -> Article result
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.{BindingPersist, Store}
  alias CMS.Articles.Bindings.Tags
  alias CMS.Articles.Commands.{BindingConfirmation, BindingSupport}
  alias CMS.Command
  alias CMS.Communities, as: CommunityFacade
  alias CMS.Gate.ErrorCat, as: GateErrorCat

  @doc "Executes or replays one authorized move command."
  def execute(source, destination, article_id, tag_ids, %User{} = actor, command_id) do
    with {:ok, article} <- BindingSupport.load_article(article_id),
         {:ok, :supported} <- BindingSupport.ensure_ordinary(article) do
      %Command{
        actor: actor,
        command_id: command_id,
        operation: :article_move,
        target: article,
        params: %{
          source_community_id: source.id,
          destination_community_id: destination.id,
          tag_ids: tag_ids
        }
      }
      |> Command.execute(
        action: &move_action(&1, source, destination),
        confirmation: BindingConfirmation
      )
      |> BindingSupport.present_article()
    end
  end

  defp move_action(
         %{actor: actor, target: article, params: params, command_id: command_id},
         source,
         destination
       ) do
    CMS.Gate.with_community_check(actor, :move, source, article, fn canonical ->
      with {:ok, source_binding} <- source_binding(source, canonical.id),
           {:ok, moved} <- BindingPersist.move(canonical, source, destination),
           {:ok, destination_binding} <- Store.binding(moved.id, destination.id),
           {:ok, _binding} <- Tags.replace(destination_binding, params.tag_ids),
           {:ok, _source} <- CommunityFacade.update_count_field(source, canonical.thread),
           {:ok, _destination} <-
             CommunityFacade.update_count_field(destination, canonical.thread),
           {:ok, _} <-
             BindingSupport.invalidate_scope(source, source_binding, canonical.thread, command_id),
           {:ok, _} <-
             BindingSupport.invalidate_scope(
               destination,
               destination_binding,
               canonical.thread,
               command_id
             ),
           {:ok, :pass} <- CMS.SearchArtiments.Indexer.enqueue_upsert(moved) do
        {:ok, BindingSupport.confirmation(canonical, destination, command_id)}
      end
    end)
  end

  defp source_binding(source, article_id) do
    case Store.binding(article_id, source.id) do
      {:ok, binding} -> {:ok, binding}
      {:error, _reason} -> {:error, GateErrorCat.resource_not_found()}
    end
  end
end
