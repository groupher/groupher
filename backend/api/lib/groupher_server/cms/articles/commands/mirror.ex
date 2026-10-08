defmodule GroupherServer.CMS.Articles.Commands.Mirror do
  @moduledoc """
  Adds one ordinary Article binding without changing the stable Article identity.

      CMS.Articles.mirror -> CMS.Command -> Gate -> BindingWriter -> binding result
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.BindingWriter
  alias CMS.Articles.Bindings.Tags
  alias CMS.Articles.Commands.{BindingConfirmation, BindingSupport}
  alias CMS.Command

  @doc "Executes or replays one authorized mirror command."
  def execute(destination, article_id, tag_ids, %User{} = actor, source, command_id) do
    with {:ok, article} <- BindingSupport.load_article(article_id),
         {:ok, :supported} <- BindingSupport.ensure_ordinary(article) do
      %Command{
        actor: actor,
        command_id: command_id,
        operation: :article_mirror,
        target: article,
        params: %{
          source_community_id: source.id,
          destination_community_id: destination.id,
          tag_ids: tag_ids
        }
      }
      |> Command.execute(
        action: &mirror_action(&1, source, destination),
        confirmation: BindingConfirmation
      )
      |> BindingSupport.present_binding()
    end
  end

  defp mirror_action(
         %{actor: actor, target: article, params: params, command_id: command_id},
         source,
         destination
       ) do
    CMS.Gate.Access.with_community_check(actor, :mirror, source, article, fn canonical ->
      with {:ok, binding} <- BindingWriter.mirror(canonical, destination),
           {:ok, binding} <- Tags.replace(binding, params.tag_ids),
           {:ok, _} <-
             BindingSupport.invalidate_scope(destination, binding, canonical.thread, command_id) do
        {:ok, BindingSupport.confirmation(canonical, destination, command_id)}
      end
    end)
  end
end
