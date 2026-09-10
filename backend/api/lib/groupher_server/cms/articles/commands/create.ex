defmodule GroupherServer.CMS.Articles.Commands.Create do
  @moduledoc """
  Runs the idempotent command that creates and immediately publishes an Article.

  Business position:

      CMS.Articles facade
        -> Commands.Create
        -> CommandReceipt
        -> Articles.Publish / Articles.Draft
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.Articles.{Draft, Publish}
  alias CMS.CommandReceipt
  alias CMS.Model.Community
  alias Helper.T

  @doc "Creates and publishes one Article under a stable command key."
  @spec create(Community.t(), T.thread(), map(), User.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def create(community, thread, attrs, %User{} = user, opts) do
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts, attrs) do
      attrs = drop_command_key(attrs)
      target_key = command_target(community, thread, Map.get(attrs, :article_hash_id, "new"))

      CommandReceipt.run_user_command(
        user,
        command_key,
        "article.create",
        "article",
        target_key,
        attrs,
        fn ->
          with {:ok, result} <- Publish.create(community, thread, attrs, user) do
            {:ok, result, %{result_key: result.article_hash_id}}
          end
        end,
        fn receipt ->
          article_hash_id = receipt.result_key || Map.get(attrs, :article_hash_id)
          Draft.read_public(community, thread, article_hash_id, attrs)
        end
      )
    end
  end

  defp drop_command_key(opts) when is_list(opts), do: Keyword.delete(opts, :command_key)
  defp drop_command_key(opts) when is_map(opts), do: Map.delete(opts, :command_key)
  defp drop_command_key(opts), do: opts

  defp command_target(%Community{id: id}, thread, key), do: "#{id}:#{thread}:#{key}"
  defp command_target(community, thread, key), do: "#{community}:#{thread}:#{key}"
end
