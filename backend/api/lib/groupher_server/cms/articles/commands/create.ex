defmodule GroupherServer.CMS.Articles.Commands.Create do
  @moduledoc """
  Runs the idempotent command that creates and immediately publishes an Article.

  Business position:

      CMS.Articles facade
        -> Commands.Create
        -> CMS.Command
        -> Articles.Publish / Articles.Draft
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Articles.{Draft, Publish}
  alias CMS.Command
  alias CMS.Model.Community
  alias Helper.T

  @doc "Creates and publishes one Article under a stable command id."
  @spec create(Community.t(), T.thread(), map(), User.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def create(community, thread, attrs, %User{} = user, opts) do
    with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
      attrs = drop_command_id(attrs)

      Command.create_user(user, command_id,
        command: :article_create,
        resource: :article,
        owner: community,
        input: %{thread: thread, attrs: attrs},
        recovery: fn receipt ->
          article_hash_id = receipt.result_key || Map.get(attrs, :article_hash_id)
          Draft.read_command_result(community, thread, article_hash_id, attrs)
        end
      )
      |> Command.run(fn %{input: %{thread: thread, attrs: attrs}} ->
        with {:ok, result} <- Publish.create(community, thread, attrs, user) do
          {:ok, result, %{result_key: result.article_hash_id}}
        end
      end)
    end
  end

  defp drop_command_id(opts) when is_list(opts), do: Keyword.delete(opts, :command_id)
  defp drop_command_id(opts) when is_map(opts), do: Map.delete(opts, :command_id)
  defp drop_command_id(opts), do: opts

  defp option(opts, key) when is_map(opts), do: Map.get(opts, key)
  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
  defp option(_opts, _key), do: nil
end
