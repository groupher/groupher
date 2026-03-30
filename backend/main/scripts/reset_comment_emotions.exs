import Ecto.Query, warn: false

import GroupherServer.Support.Factory, only: [db_insert_multi: 2]

alias GroupherServer.{CMS, Repo}
alias GroupherServer.CMS.Model.{Comment, CommentUserEmotion}
alias Helper.ORM

supported_comment_emotions =
  Application.compile_env(:groupher_server, :article, [])
  |> Keyword.get(:comment_emotions, [])

default_emotions = GroupherServer.CMS.Model.Embeds.CommentEmotion.default_emotions()

comment_id =
  case System.argv() do
    [id | _] ->
      if id == "--" or String.starts_with?(id, "-") do
        raise "Invalid comment id: '#{id}'."
      end

      case Integer.parse(id) do
        {value, ""} when value > 0 -> value
        _ -> raise "Invalid comment id: '#{id}'. Use a positive integer."
      end

    _ ->
      raise "Usage: mix run scripts/reset_comment_emotions.exs -- <comment_id>"
  end

with {:ok, target_comment} <- CMS.Comments.fetch_comment(comment_id) do
  IO.puts("Resetting all comment emotions across communities ...")

  {deleted_count, _} =
    Repo.delete_all(from(c in CommentUserEmotion), timeout: 300_000)

  comments =
    Repo.all(
      from(c in Comment,
        order_by: [asc: c.id]
      ),
      timeout: 300_000
    )

  reset_count =
    Enum.reduce(comments, 0, fn comment, acc ->
      {:ok, updated_comment} = ORM.update_embed(comment, :emotions, default_emotions)

      if updated_comment.reply_to_id do
        {:ok, _} = CMS.FrontDesk.sync_embed_replies(updated_comment)
      end

      acc + 1
    end)

  {:ok, article} = CMS.FrontDesk.article_of(target_comment)
  {:ok, thread} = CMS.FrontDesk.thread_of(target_comment)

  allowed_emotions =
    Enum.filter(supported_comment_emotions, fn emotion ->
      match?(
        {:ok, _},
        CMS.CanCan.allow_emotion(article.community_slug, :comment, thread, emotion)
      )
    end)

  if allowed_emotions == [] do
    raise "No allowed comment emotions found for comment ##{comment_id}."
  end

  seed_user_count = Enum.random(4..7)
  {:ok, users} = db_insert_multi(:user, seed_user_count)

  applied =
    Enum.reduce(users, [], fn user, acc ->
      picks =
        allowed_emotions
        |> Enum.shuffle()
        |> Enum.take(Enum.random(1..min(3, length(allowed_emotions))))

      Enum.reduce(picks, acc, fn emotion, inner_acc ->
        case CMS.Comments.emotion_to_comment(comment_id, emotion, user) do
          {:ok, _comment} ->
            [{user.login, emotion} | inner_acc]

          {:error, reason} ->
            raise "Failed to seed #{emotion} for #{user.login}: #{inspect(reason)}"
        end
      end)
    end)
    |> Enum.reverse()

  {:ok, seeded_comment} = CMS.Comments.one_comment(comment_id)

  IO.puts("✓ Comment emotions reset complete")
  IO.puts("  deleted emotion rows: #{deleted_count}")
  IO.puts("  reset comments: #{reset_count}")
  IO.puts("  target comment id: #{comment_id}")
  IO.puts("  article community: #{article.community_slug}")
  IO.puts("  thread: #{thread}")
  IO.puts("  allowed emotions: #{Enum.join(Enum.map(allowed_emotions, &to_string/1), ", ")}")
  IO.puts("  seeded users: #{seed_user_count}")
  IO.puts("  applied reactions: #{length(applied)}")

  Enum.each(applied, fn {login, emotion} ->
    IO.puts("    - #{login}: #{emotion}")
  end)

  IO.puts("  resulting cached emotions:")

  seeded_comment.emotions
  |> Map.from_struct()
  |> Enum.reject(fn {key, _value} ->
    key_str = Atom.to_string(key)
    String.starts_with?(key_str, "viewer_has_")
  end)
  |> Enum.each(fn {key, value} ->
    IO.puts("    #{key}: #{inspect(value)}")
  end)
else
  {:error, reason} ->
    IO.puts("✗ Failed to reset comment emotions: #{inspect(reason)}")
    System.halt(1)
end
