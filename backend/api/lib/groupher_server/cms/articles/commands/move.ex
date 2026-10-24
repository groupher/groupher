defmodule GroupherServer.CMS.Articles.Commands.Move do
  @moduledoc """
  Moves an ordinary Article from one explicit Community binding to another.

      CMS.Articles.move -> CMS.Command -> Gate -> BindingPersist -> Article result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.{BindingPersist, Store, Publish.Target}
  alias CMS.Articles.Bindings.Tags
  alias CMS.Articles.Commands.{BindingConfirmation, BindingSupport}
  alias CMS.Communities, as: CommunityFacade
  alias CMS.Gate.ErrorCat, as: GateErrorCat

  @doc "Executes or replays one authorized move command."
  def execute(source, destination, article_id, tag_ids, %User{} = actor, command_id) do
    with {:ok, article} <- BindingSupport.load_article(article_id),
         {:ok, :supported} <- BindingSupport.ensure_ordinary(article) do
      execute_pipeline(
        article,
        source,
        source.id,
        destination,
        destination.id,
        tag_ids,
        actor,
        command_id
      )
    end
  end

  @pipeline operation: :article_move,
            confirmation: BindingConfirmation,
            target: :article,
            params: [:source_community_id, :destination_community_id, :tag_ids]

  receipt_pipeline execute_pipeline(
                     article,
                     source,
                     source_community_id,
                     destination,
                     destination_community_id,
                     tag_ids,
                     actor,
                     command_id
                   ) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :move, candidate, source) end)

    change(fn canonical ->
      with {:ok, source_binding} <- source_binding(source, canonical.id),
           {:ok, :pass} <- Target.remove_binding_review(canonical, source, command_id),
           {:ok, moved} <- BindingPersist.move(canonical, source, destination),
           {:ok, destination_binding} <- Store.binding(moved.id, destination.id),
           {:ok, _binding} <- Tags.replace(destination_binding, tag_ids),
           {:ok, :pass} <- Target.register_binding_review(canonical, destination, command_id),
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
        {:ok, canonical}
      end
    end)

    confirm(fn canonical ->
      {:ok, BindingSupport.confirmation(canonical, destination, command_id)}
    end)

    present(fn confirmation -> BindingSupport.present_article({:ok, confirmation}) end)
  end

  defp source_binding(source, article_id) do
    case Store.binding(article_id, source.id) do
      {:ok, binding} -> {:ok, binding}
      {:error, _reason} -> {:error, GateErrorCat.resource_not_found()}
    end
  end
end
