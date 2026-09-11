defmodule GroupherServer.CMS.Articles.Commands.Publish do
  @moduledoc """
  Runs the idempotent command that publishes an ordinary Article Draft.

  Business position:

      CMS.Articles facade
        -> Commands.Publish
        -> CommandReceipt
        -> Articles.Publish / Articles.Draft
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.Articles.{Draft, Publish}
  alias CMS.CommandReceipt
  alias CMS.Model.Community
  alias Helper.T

  @doc "Publishes an Article Draft under a stable command key."
  @spec publish(Community.t(), T.thread(), T.article(), User.t(), keyword() | map()) ::
          T.domain_res(%{article: T.article(), snapshot: nil})
  def publish(community, thread, article, %User{} = user, opts) when is_struct(article) do
    publish(community, thread, article.article_hash_id, user, opts)
  end

  @spec publish(Community.t(), T.thread(), Ecto.UUID.t(), User.t(), keyword() | map()) ::
          T.domain_res(%{article: T.article(), snapshot: nil})
  def publish(community, thread, article_hash_id, %User{} = user, opts) do
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts) do
      opts = drop_command_key(opts)
      target_key = command_target(community, thread, article_hash_id)

      CommandReceipt.run_user_command(
        user,
        command_key,
        "article.publish_draft",
        "article",
        target_key,
        opts,
        fn ->
          with {:ok, result} <- Publish.publish(community, thread, article_hash_id, user, opts) do
            {:ok, result, %{result_key: result.article.article_hash_id}}
          end
        end,
        fn _receipt ->
          with {:ok, article} <- Draft.read_public(community, thread, article_hash_id, opts) do
            {:ok, %{article: article, snapshot: nil}}
          end
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
