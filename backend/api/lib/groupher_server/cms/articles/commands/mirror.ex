defmodule GroupherServer.CMS.Articles.Commands.Mirror do
  @moduledoc """
  Adds one ordinary Article binding without changing the stable Article identity.

      CMS.Articles.mirror -> CMS.Command -> Gate -> BindingPersist -> binding result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.{BindingPersist, Publish.Target, Bindings.Tags}
  alias CMS.Articles.Commands.{BindingConfirmation, BindingSupport}

  @doc "Executes or replays one authorized mirror command."
  def execute(destination, article_id, tag_ids, %User{} = actor, source, command_id) do
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

  @pipeline operation: :article_mirror,
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
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :mirror, candidate, source) end)

    change(fn canonical ->
      with {:ok, binding} <- BindingPersist.mirror(canonical, destination),
           {:ok, binding} <- Tags.replace(binding, tag_ids),
           {:ok, :pass} <- Target.register_binding_review(canonical, destination, command_id),
           {:ok, _} <-
             BindingSupport.invalidate_scope(destination, binding, canonical.thread, command_id),
           {:ok, _destination} <-
             CMS.Communities.update_count_field(destination, canonical.thread) do
        {:ok, canonical}
      end
    end)

    confirm(fn canonical ->
      {:ok, BindingSupport.confirmation(canonical, destination, command_id)}
    end)

    present(fn confirmation -> BindingSupport.present_article({:ok, confirmation}) end)
  end
end
