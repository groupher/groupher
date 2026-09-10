defmodule GroupherServer.CMS.Articles.Commands.Update do
  @moduledoc """
  Runs the idempotent command that updates an Article's persistent Draft.

  Business position:

      CMS.Articles facade
        -> Commands.Update
        -> CommandReceipt
        -> Articles.Publish / Articles.Draft
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.{Draft, Publish}
  alias CMS.CommandReceipt
  alias CMS.Model.Community
  alias Helper.T

  @doc "Updates an Article Draft under a stable command key."
  @spec update(T.article(), map(), User.t()) :: T.domain_res(T.article())
  def update(article, attrs, %User{} = user) do
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(attrs) do
      attrs = drop_command_key(attrs)

      target_key =
        command_target(article, Map.get(article, :thread, "article"), article.article_hash_id)

      CommandReceipt.run_user_command(
        user,
        command_key,
        "article.update",
        "article",
        target_key,
        attrs,
        fn ->
          with {:ok, result} <- Publish.update(article, attrs, user) do
            {:ok, result, %{result_key: result.article_hash_id}}
          end
        end,
        fn _receipt ->
          with {:ok, thread} <- CMS.FrontDesk.thread_of(article),
               %Community{} = community <- Repo.get(Community, article.community_id) do
            Draft.read(community, thread, article.article_hash_id, attrs)
          end
        end
      )
    end
  end

  defp drop_command_key(opts) when is_map(opts), do: Map.delete(opts, :command_key)
  defp drop_command_key(opts), do: opts

  defp command_target(%{community_id: id}, thread, key), do: "#{id}:#{thread}:#{key}"
end
