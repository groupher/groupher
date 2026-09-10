defmodule GroupherServer.CMS.Articles.Commands.Trash do
  @moduledoc """
  Runs idempotent Article trash, restore, and permanent-delete commands.

  Gate admission and Article lifecycle writes remain in `Articles.Trash`.
  Denied Activity facts are persisted outside the receipt transaction here.

  Business position:

      CMS.Articles facade
        -> Commands.Trash
        -> CommandReceipt
        -> Articles.Trash / Articles.Draft
        -> Activity for denied facts
  """

  alias GroupherServer.{Activity, CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.{Draft, Trash, ErrorCat}
  alias CMS.CommandReceipt
  alias CMS.Model.{Community, TrashedArticle, TrashedDocArticle}
  alias Helper.T

  @doc "Moves one logical Article into Trash."
  @spec trash(T.article(), User.t() | nil, keyword()) :: T.domain_res(TrashedArticle.t())
  def trash(article, actor, opts)

  def trash(article, %User{} = actor, opts) do
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts) do
      opts = drop_command_key(opts)

      target_key =
        command_target(article, option(article, :thread, "article"), article.article_hash_id)

      CommandReceipt.run_user_command(
        actor,
        command_key,
        "article.trash",
        "article",
        target_key,
        opts,
        fn ->
          with {:ok, result} <- Trash.trash(article, actor, opts) do
            {:ok, result, %{result_key: result.hash_id}}
          end
        end,
        fn receipt -> Trash.get(receipt.result_key) end
      )
      |> persist_denied_trash(article, actor, command_key)
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
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts) do
      clean_opts = drop_command_key(opts)

      case resolve_trash_item(item_or_ref) do
        {:ok, item} ->
          target_key = command_target(item.community_id, item.thread, item.hash_id)

          CommandReceipt.run_user_command(
            actor,
            command_key,
            "article.restore",
            "article_trash",
            target_key,
            clean_opts,
            fn ->
              with {:ok, result} <- Trash.restore(item, actor, clean_opts) do
                {:ok, result, %{result_key: result.article_hash_id}}
              end
            end,
            fn receipt ->
              replay_restored_article(receipt, item.community_id, item.thread, clean_opts)
            end
          )

        {:error, _reason} ->
          replay_or_resolve_missing_trash(
            item_or_ref,
            actor,
            command_key,
            clean_opts,
            "article.restore",
            fn receipt ->
              with community_id when is_integer(community_id) <- option(clean_opts, :community_id),
                   thread when is_atom(thread) <- option(clean_opts, :thread),
                   article_hash_id when is_binary(article_hash_id) <- receipt.result_key,
                   {:ok, community} <- fetch_community(community_id) do
                Draft.read_editor(community, thread, article_hash_id, clean_opts)
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
      with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts) do
        clean_opts = drop_command_key(opts)

        case resolve_trash_item(item_or_ref) do
          {:ok, item} ->
            target_key = command_target(item.community_id, item.thread, item.hash_id)

            CommandReceipt.run_user_command(
              actor,
              command_key,
              "article.permanently_delete",
              "article_trash",
              target_key,
              clean_opts,
              fn -> Trash.permanently_delete(item, actor, clean_opts) end,
              fn _receipt -> {:ok, %{done: true}} end
            )

          {:error, _reason} ->
            replay_or_resolve_missing_trash(
              item_or_ref,
              actor,
              command_key,
              clean_opts,
              "article.permanently_delete",
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
         command_key,
         opts,
         command_name,
         replay
       ) do
    target_key =
      command_target(
        option(opts, :community_id, "unknown"),
        option(opts, :thread, "article"),
        item_or_ref
      )

    CommandReceipt.run_user_command(
      actor,
      command_key,
      command_name,
      "article_trash",
      target_key,
      opts,
      fn ->
        with {:ok, item} <- resolve_trash_item(item_or_ref),
             :ok <- verify_trash_scope(item, opts),
             {:ok, result} <-
               if(command_name == "article.restore",
                 do: Trash.restore(item, actor, opts),
                 else: Trash.permanently_delete(item, actor, opts)
               ) do
          result_key =
            if command_name == "article.restore", do: result.article_hash_id, else: target_key

          {:ok, result, %{result_key: result_key}}
        end
      end,
      replay
    )
  end

  defp replay_restored_article(receipt, community_id, thread, opts) do
    with {:ok, community} <- fetch_community(community_id),
         article_hash_id when is_binary(article_hash_id) <- receipt.result_key do
      Draft.read_editor(community, thread, article_hash_id, opts)
    else
      _ -> {:error, ErrorCat.not_exist("Article")}
    end
  end

  defp persist_denied_trash(
         {:error, %CMS.Gate.Decision{} = decision},
         article,
         %User{} = actor,
         command_key
       ) do
    reason = CMS.Gate.Decision.primary_reason(decision)

    case Activity.log(article, :trashed,
           actor: actor,
           outcome: :denied,
           denial_code: reason,
           operation_ref: command_key
         ) do
      {:ok, _event} -> {:error, decision}
      {:error, %GroupherServer.ErrorCat.Error{reason: :duplicate_event}} -> {:error, decision}
      {:error, _reason} = error -> error
    end
  end

  defp persist_denied_trash(result, _article, _actor, _command_key), do: result

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

  defp drop_command_key(opts) when is_list(opts), do: Keyword.delete(opts, :command_key)
  defp drop_command_key(opts) when is_map(opts), do: Map.delete(opts, :command_key)
  defp drop_command_key(opts), do: opts

  defp command_target(%{community_id: id}, thread, key), do: command_target(id, thread, key)
  defp command_target(community, thread, key), do: "#{community}:#{thread}:#{key}"
end
