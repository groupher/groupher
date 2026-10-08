defmodule GroupherServer.CMS.Articles.Commands.Unmirror do
  @moduledoc """
  Removes one ordinary Article binding while preserving the stable Article.

      CMS.Articles.unmirror -> CMS.Command -> Gate -> BindingWriter -> done
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.{BindingWriter, Store}
  alias CMS.Articles.Commands.{BindingConfirmation, BindingSupport}
  alias CMS.Command

  @doc "Executes or replays one authorized unmirror command."
  def execute(community, article_id, %User{} = actor, command_id) do
    with {:ok, article} <- BindingSupport.load_article(article_id),
         {:ok, :supported} <- BindingSupport.ensure_ordinary(article) do
      %Command{
        actor: actor,
        command_id: command_id,
        operation: :article_unmirror,
        target: article,
        params: %{community_id: community.id}
      }
      |> Command.execute(
        action: &unmirror_action(&1, community),
        confirmation: BindingConfirmation
      )
      |> BindingSupport.present_done()
    end
  end

  defp unmirror_action(%{actor: actor, target: article, command_id: command_id}, community) do
    CMS.Gate.Access.with_community_check(actor, :unmirror, community, article, fn canonical ->
      with {:ok, binding} <- Store.binding(canonical.id, community.id),
           {:ok, :done} <- BindingWriter.unmirror(canonical, community),
           {:ok, _} <-
             BindingSupport.invalidate_scope(community, binding, canonical.thread, command_id) do
        {:ok, BindingSupport.confirmation(canonical, community, command_id)}
      end
    end)
  end
end
