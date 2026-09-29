defmodule GroupherServer.CMS.Articles.Commands.Update do
  @moduledoc """
  Runs the idempotent command that updates an Article's persistent Draft.

  Business position:

      CMS.Articles facade
        -> Commands.Update
        -> CMS.Command
        -> Articles.Publish / Articles.Draft
  """

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Articles.{Draft, Publish}
  alias CMS.Command
  alias CMS.Model.Community
  alias Helper.T

  @doc "Updates an Article Draft under a stable command id."
  @spec update(T.article(), map(), User.t(), Ecto.UUID.t()) :: T.domain_res(T.article())
  def update(article, attrs, %User{} = user, command_id) do
    with {:ok, command_id} <- Command.resolve_command_id(command_id) do
      attrs = Map.delete(attrs, :command_id)

      Command.update_user(user, command_id,
        command: :article_update,
        resource: article,
        input: attrs,
        recovery: fn _receipt ->
          with {:ok, thread} <- CMS.FrontDesk.thread_of(article),
               %Community{} = community <- Repo.get(Community, article.community_id),
               {:ok, result} <-
                 Draft.read_command_result(community, thread, article.article_hash_id, attrs) do
            {:ok, Map.put(result, :command_id, command_id)}
          end
        end
      )
      |> Command.run(fn %{resource: canonical, input: input} ->
        with {:ok, result} <- Publish.update(canonical, input, user) do
          {:ok, Map.put(result, :command_id, command_id), %{result_key: result.article_hash_id}}
        end
      end)
    end
  end
end
