defmodule GroupherServer.CMS.Articles.Commands.Draft do
  @moduledoc """
  Runs idempotent create and update commands for persistent Article Drafts.

  Business position:

      CMS.Articles facade
        -> Commands.Draft
        -> CommandReceipt
        -> Articles.Draft
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.Articles.Draft, as: ArticleDraft
  alias CMS.CommandReceipt
  alias CMS.Model.Community
  alias Helper.T

  @doc "Creates a persistent Article Draft under a stable command key."
  @spec create(Community.t(), T.thread(), map(), User.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def create(community, thread, attrs, %User{} = user, opts) do
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts, attrs) do
      attrs = drop_command_key(attrs)
      target_key = command_target(community, thread, Map.get(attrs, :article_hash_id, "new"))

      CommandReceipt.run_user_command(
        user,
        command_key,
        "article.create_draft",
        "article",
        target_key,
        attrs,
        fn ->
          with {:ok, result} <- ArticleDraft.create(community, thread, attrs, user) do
            {:ok, result, %{result_key: result.article_hash_id}}
          end
        end,
        fn receipt ->
          article_hash_id = receipt.result_key || Map.get(attrs, :article_hash_id)
          ArticleDraft.read(community, thread, article_hash_id, attrs)
        end
      )
    end
  end

  @doc "Updates or creates a persistent Article Draft under a stable command key."
  @spec update(Community.t(), T.thread(), Ecto.UUID.t(), map(), User.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def update(community, thread, article_hash_id, attrs, %User{} = user, opts) do
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts, attrs) do
      attrs = drop_command_key(attrs)
      target_key = command_target(community, thread, article_hash_id)

      CommandReceipt.run_user_command(
        user,
        command_key,
        "article.update_draft",
        "article",
        target_key,
        attrs,
        fn ->
          with {:ok, result} <-
                 ArticleDraft.update_or_create_from_public(
                   community,
                   thread,
                   article_hash_id,
                   attrs,
                   user
                 ) do
            {:ok, result, %{result_key: result.article_hash_id}}
          end
        end,
        fn _receipt -> ArticleDraft.read_editor(community, thread, article_hash_id, attrs) end
      )
    end
  end

  defp drop_command_key(opts) when is_list(opts), do: Keyword.delete(opts, :command_key)
  defp drop_command_key(opts) when is_map(opts), do: Map.delete(opts, :command_key)
  defp drop_command_key(opts), do: opts

  defp command_target(%Community{id: id}, thread, key), do: "#{id}:#{thread}:#{key}"
  defp command_target(community, thread, key), do: "#{community}:#{thread}:#{key}"
end
