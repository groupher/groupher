defmodule GroupherServer.CMS.Articles.Commands.Trash do
  @moduledoc """
  Runs idempotent Article trash, restore, and permanent-delete commands.

  Gate admission and Article lifecycle writes remain in `Articles.Trash`.
  Denied Activity facts are persisted outside the receipt transaction here.

  Business position:

      CMS.Articles facade
        -> Commands.Trash
        -> CMS.Command
        -> Articles.Trash / Articles.Draft
        -> Activity for denied facts
  """

  require GroupherServer.CMS.Articles.ErrorCat

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.{Draft, Trash, ErrorCat}
  alias CMS.Command
  alias CMS.Model.{Community, TrashedArticle, TrashedDocArticle}
  alias Helper.T

  @doc "Moves one logical Article into Trash."
  @spec trash(T.article(), User.t() | nil, keyword()) :: T.domain_res(TrashedArticle.t())
  def trash(article, actor, opts)

  def trash(article, %User{} = actor, opts) do
    with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
      opts = drop_command_id(opts)

      Command.update_user(actor, command_id,
        command: :article_trash,
        resource: article,
        input: opts,
        recovery: fn receipt -> Trash.get(receipt.result_key) end
      )
      |> Command.run(fn %{resource: article, input: opts} ->
        with {:ok, result} <- Trash.trash(article, actor, opts) do
          {:ok, result, %{result_key: result.hash_id}}
        end
      end)
      |> persist_denied_trash(article, actor, command_id)
    end
  end

  def trash(article, actor, opts), do: Trash.trash(article, actor, opts)

  @doc "Restores one logical Article from Trash."
  @spec restore(
          Ecto.UUID.t() | TrashedArticle.t() | TrashedDocArticle.t(),
          User.t() | nil,
          keyword()
        ) ::
          T.domain_res(T.article())
  def restore(item_or_ref, actor, opts)

  def restore(%TrashedDocArticle{} = item, actor, opts), do: Trash.restore(item, actor, opts)

  def restore(item_or_ref, %User{} = actor, opts) do
    with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
      clean_opts = drop_command_id(opts)

      case resolve_trash_item(item_or_ref) do
        {:ok, item} ->
          Command.create_user(actor, command_id,
            command: :article_restore,
            resource: :article_trash,
            owner: item.community_id,
            input: %{item_ref: item.hash_id, opts: clean_opts},
            recovery: fn receipt ->
              replay_restored_article(receipt, item.community_id, item.thread, clean_opts)
            end
          )
          |> Command.run(fn %{input: %{opts: opts}} ->
            with {:ok, result} <- Trash.restore(item, actor, opts) do
              {:ok, result, %{result_key: result.article_hash_id}}
            end
          end)

        {:error, _reason} ->
          replay_or_resolve_missing_trash(
            item_or_ref,
            actor,
            command_id,
            clean_opts,
            :article_restore,
            fn receipt ->
              with community_id when is_integer(community_id) <- option(clean_opts, :community_id),
                   thread when is_atom(thread) <- option(clean_opts, :thread),
                   article_hash_id when is_binary(article_hash_id) <- receipt.result_key,
                   {:ok, community} <- fetch_community(community_id) do
                Draft.read_editor_head(community, thread, article_hash_id, clean_opts)
              else
                _ -> {:error, ErrorCat.not_exist("Article")}
              end
            end
          )
      end
    end
  end

  def restore(item_or_ref, actor, opts), do: Trash.restore(item_or_ref, actor, opts)

  @doc "Permanently removes one standalone trashed Article aggregate."
  @spec permanently_delete(
          Ecto.UUID.t() | TrashedArticle.t() | TrashedDocArticle.t(),
          User.t() | nil,
          keyword()
        ) ::
          T.domain_res(map())
  def permanently_delete(item_or_ref, actor, opts)

  def permanently_delete(%TrashedDocArticle{} = item, actor, opts),
    do: Trash.permanently_delete(item, actor, opts)

  def permanently_delete(item_or_ref, actor, opts) do
    if match?(%User{}, actor) do
      with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
        clean_opts = drop_command_id(opts)

        case resolve_trash_item(item_or_ref) do
          {:ok, item} ->
            Command.create_user(actor, command_id,
              command: :article_permanently_delete,
              resource: :article_trash,
              owner: item.community_id,
              input: %{item_ref: item.hash_id, opts: clean_opts},
              recovery: fn _receipt -> {:ok, %{done: true}} end
            )
            |> Command.run(fn %{input: %{opts: opts}} ->
              Trash.permanently_delete(item, actor, opts)
            end)

          {:error, _reason} ->
            replay_or_resolve_missing_trash(
              item_or_ref,
              actor,
              command_id,
              clean_opts,
              :article_permanently_delete,
              fn _receipt -> {:ok, %{done: true}} end
            )
        end
      end
    else
      Trash.permanently_delete(item_or_ref, actor, opts)
    end
  end

  defp replay_or_resolve_missing_trash(
         item_or_ref,
         actor,
         command_id,
         opts,
         command,
         replay
       ) do
    Command.create_user(actor, command_id,
      command: command,
      resource: :article_trash,
      owner: option(opts, :community_id, "unknown"),
      input: %{item_ref: item_or_ref, opts: opts},
      recovery: replay
    )
    |> Command.run(fn %{input: %{item_ref: item_or_ref, opts: opts}} ->
      with {:ok, item} <- resolve_trash_item(item_or_ref),
           :ok <- verify_trash_scope(item, opts),
           {:ok, result} <-
             if(command == :article_restore,
               do: Trash.restore(item, actor, opts),
               else: Trash.permanently_delete(item, actor, opts)
             ) do
        target_key = command_target(item.community_id, item.thread, item.hash_id)

        result_key =
          if command == :article_restore, do: result.article_hash_id, else: target_key

        {:ok, result, %{result_key: result_key}}
      end
    end)
  end

  defp replay_restored_article(receipt, community_id, thread, opts) do
    with {:ok, community} <- fetch_community(community_id),
         article_hash_id when is_binary(article_hash_id) <- receipt.result_key do
      Draft.read_editor_head(community, thread, article_hash_id, opts)
    else
      _ -> {:error, ErrorCat.not_exist("Article")}
    end
  end

  defp persist_denied_trash(
         {:error, %CMS.Gate.Decision{} = decision},
         article,
         %User{} = actor,
         command_id
       ) do
    reason = CMS.Gate.Decision.primary_reason(decision)

    case Activity.log(article, :trashed,
           actor: actor,
           outcome: :denied,
           denial_code: reason,
           operation_ref: command_id
         ) do
      {:ok, _event} -> {:error, decision}
      {:error, ErrorCat.error_pattern(reason: :duplicate_event)} -> {:error, decision}
      {:error, _reason} = error -> error
    end
  end

  defp persist_denied_trash(result, _article, _actor, _command_id), do: result

  defp resolve_trash_item(%TrashedArticle{} = item), do: {:ok, item}
  defp resolve_trash_item(ref), do: Trash.get(ref)

  defp fetch_community(community_id), do: {:ok, Repo.get!(Community, community_id)}

  defp verify_trash_scope(item, opts) do
    if option(opts, :community_id) in [nil, item.community_id] and
         option(opts, :thread) in [nil, item.thread],
       do: :ok,
       else: {:error, ErrorCat.not_exist("TrashedArticle")}
  end

  defp option(opts, key, default \\ nil)
  defp option(opts, key, default) when is_list(opts), do: Keyword.get(opts, key, default)
  defp option(opts, key, default) when is_map(opts), do: Map.get(opts, key, default)
  defp option(_opts, _key, default), do: default

  defp drop_command_id(opts) when is_list(opts), do: Keyword.delete(opts, :command_id)
  defp drop_command_id(opts) when is_map(opts), do: Map.delete(opts, :command_id)
  defp drop_command_id(opts), do: opts

  defp command_target(%{community_id: id}, thread, key), do: command_target(id, thread, key)
  defp command_target(community, thread, key), do: "#{community}:#{thread}:#{key}"
end
