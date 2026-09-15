defmodule GroupherServer.CMS.Articles.Commands.Publish do
  @moduledoc """
  Runs the idempotent command that publishes an ordinary Article Draft.

  Business position:

      CMS.Articles facade
        -> Commands.Publish
        -> CMS.Command
        -> Articles.Publish / Articles.Draft
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Articles.{Draft, Publish}
  alias CMS.Command
  alias CMS.Model.Community
  alias Helper.T

  @doc "Publishes an Article Draft under a stable command id."
  @spec publish(Community.t(), T.thread(), T.article(), User.t(), keyword() | map()) ::
          T.domain_res(%{article: T.article(), snapshot: nil})
  def publish(community, thread, article, %User{} = user, opts) when is_struct(article) do
    publish(community, thread, article.article_hash_id, user, opts)
  end

  @spec publish(Community.t(), T.thread(), Ecto.UUID.t(), User.t(), keyword() | map()) ::
          T.domain_res(%{article: T.article(), snapshot: nil})
  def publish(community, thread, article_hash_id, %User{} = user, opts) do
    with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
      opts = drop_command_id(opts)

      Command.create_user(user, command_id,
        command: :article_publish_draft,
        resource: :article,
        owner: community,
        input: %{thread: thread, article_hash_id: article_hash_id, opts: opts},
        recovery: fn _receipt ->
          with {:ok, article} <- Draft.read_public(community, thread, article_hash_id, opts) do
            {:ok, %{article: article, snapshot: nil}}
          end
        end
      )
      |> Command.run(fn %{input: %{opts: opts}} ->
        with {:ok, result} <- Publish.publish(community, thread, article_hash_id, user, opts) do
          {:ok, result, %{result_key: result.article.article_hash_id}}
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
