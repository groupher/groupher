defmodule GroupherServer.CMS.Articles.Commands.Draft do
  @moduledoc """
  Runs idempotent create and update commands for persistent Article Drafts.

  Business position:

      CMS.Articles facade
        -> Commands.Draft
        -> CMS.Command
        -> Articles.Draft
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Articles.Draft, as: ArticleDraft
  alias CMS.Command
  alias CMS.Model.Community
  alias Helper.T

  @doc "Creates a persistent Article Draft under a stable command id."
  @spec create(Community.t(), T.thread(), map(), User.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def create(community, thread, attrs, %User{} = user, opts) do
    with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
      attrs = drop_command_id(attrs)

      Command.create_user(user, command_id,
        command: :article_create_draft,
        resource: :article,
        owner: community,
        input: %{thread: thread, attrs: attrs},
        recovery: fn receipt ->
          article_hash_id = receipt.result_key || Map.get(attrs, :article_hash_id)
          ArticleDraft.read(community, thread, article_hash_id, attrs)
        end
      )
      |> Command.run(fn %{input: %{attrs: attrs}} ->
        with {:ok, result} <- ArticleDraft.create(community, thread, attrs, user) do
          {:ok, result, %{result_key: result.article_hash_id}}
        end
      end)
    end
  end

  @doc "Updates or creates a persistent Article Draft under a stable command id."
  @spec update(Community.t(), T.thread(), T.article(), map(), User.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def update(community, thread, article, attrs, %User{} = user, opts) when is_struct(article) do
    update(community, thread, article.article_hash_id, attrs, user, opts)
  end

  @spec update(Community.t(), T.thread(), Ecto.UUID.t(), map(), User.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def update(community, thread, article_hash_id, attrs, %User{} = user, opts) do
    with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
      attrs = drop_command_id(attrs)

      Command.create_user(user, command_id,
        command: :article_update_draft,
        resource: :article,
        owner: community,
        input: %{thread: thread, article_hash_id: article_hash_id, attrs: attrs},
        recovery: fn _receipt ->
          ArticleDraft.read_editor_head(community, thread, article_hash_id, attrs)
        end
      )
      |> Command.run(fn %{input: %{attrs: attrs}} ->
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
