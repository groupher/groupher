defmodule GroupherServer.CMS.Interactions.Reactions.Emotion do
  @moduledoc """
  Owns the complete idempotent Article and Comment emotion flow.

      CMS.Interactions
        -> Gate canonical Artiment
        -> allowed emotion
        -> emotion fact changed/unchanged
        -> Interaction State in the same transaction
  """

  import Ecto.Query

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Artiment.Matcher
  alias GroupherServer.CMS.Communities.Enable
  alias GroupherServer.CMS.{Events, Gate}
  alias GroupherServer.CMS.Interactions.{Config, ErrorCat, ReadState}
  alias GroupherServer.CMS.CommandReceipt
  alias GroupherServer.CMS.Model.{ArticleUserEmotion, Author, Comment, CommentUserEmotion}
  alias GroupherServer.Repo
  alias Helper.{Later, T}

  @doc """
  Applies an emotion as an idempotent set-state command.

  ## Examples

      Reactions.Emotion.add(comment, :heart, actor)

  """
  @spec add(struct(), atom(), User.t(), String.t() | nil) :: T.domain_res(struct())
  def add(artiment, emotion, %User{} = actor, command_key \\ nil),
    do: mutate(artiment, emotion, actor, :add, command_key)

  @doc """
  Removes an emotion as an idempotent set-state command.

  ## Examples

      Reactions.Emotion.remove(comment, :heart, actor)

  """
  @spec remove(struct(), atom(), User.t(), String.t() | nil) :: T.domain_res(struct())
  def remove(artiment, emotion, %User{} = actor, command_key \\ nil),
    do: mutate(artiment, emotion, actor, :remove, command_key)

  defp mutate(input, emotion, actor, operation, command_key) when is_atom(emotion) do
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(command_key),
         {:ok, info} <- Matcher.match_interaction(input) do
      CommandReceipt.run_user_command(
        actor,
        command_key,
        "emotion_#{operation}:#{emotion}",
        Atom.to_string(info.artiment),
        input.id,
        nil,
        fn ->
          with {:ok, canonical} <- Gate.access_check(actor, :emotion, input),
               {:ok, _thread_key} <- allow_emotion(canonical, info, emotion),
               {:ok, change} <- change_fact(canonical, info, emotion, actor, operation),
               :ok <- sync_state(canonical, emotion, actor, operation, change) do
            {:ok, {canonical, change}, %{outcome: change}}
          end
        end,
        fn receipt -> {:ok, {input, {:replayed, replay_outcome(receipt)}}} end
      )
      |> after_commit(operation, actor, command_key)
    end
  end

  defp mutate(_input, emotion, _actor, _operation, _command_key),
    do: {:error, ErrorCat.emotion_not_allowed(inspect(emotion))}

  defp replay_outcome(%{outcome: "unchanged"}), do: :unchanged
  defp replay_outcome(_receipt), do: :changed

  defp allow_emotion(%Comment{} = comment, _info, emotion) do
    Enable.emotion?(comment.community.slug, :comment, comment.thread, emotion)
  end

  defp allow_emotion(article, info, emotion) do
    Enable.emotion?(article.community.slug, :article, info.artiment, emotion)
  end

  defp sync_state(_canonical, _emotion, _actor, _operation, :unchanged), do: :ok

  defp sync_state(canonical, emotion, actor, operation, :changed) do
    result =
      if operation == :add,
        do: ReadState.add_emotion(canonical, emotion, actor),
        else: ReadState.remove_emotion(canonical, emotion, actor)

    case result do
      {:ok, _projection} -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp after_commit({:ok, {canonical, :changed}}, :add, actor, command_key) do
    if match?(%Comment{}, canonical) do
      Later.run({Events, :emit, [:subscribe_community, %{target: canonical, user: actor}]})
    end

    {:ok, put_reaction_metadata(canonical, command_key, :changed, false)}
  end

  defp after_commit({:ok, {canonical, change}}, _operation, _actor, command_key),
    do:
      {:ok,
       put_reaction_metadata(
         canonical,
         command_key,
         case change do
           {:replayed, outcome} -> outcome
           :changed -> :changed
           _ -> :unchanged
         end,
         match?({:replayed, _}, change)
       )}

  defp after_commit({:error, reason}, _operation, _actor, _command_key), do: {:error, reason}

  defp put_reaction_metadata(canonical, command_key, outcome, command_replayed) do
    canonical
    |> Map.put(:command_key, command_key)
    |> Map.put(:command_replayed, command_replayed)
    |> Map.put(:reaction_outcome, outcome)
  end

  @doc """
  Safely decodes a persisted emotion using the bounded vocabulary.

  ## Examples

      Reactions.Emotion.decode("heart", :article)
      #=> {:ok, :heart}

  """
  @spec decode(String.t(), :article | :comment) ::
          {:ok, atom()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def decode(value, type) when is_binary(value) and type in [:article, :comment] do
    vocabulary = if type == :article, do: Config.emotions(), else: Config.comment_emotions()

    case Enum.find(vocabulary, &(Atom.to_string(&1) == value)) do
      emotion when is_atom(emotion) and not is_nil(emotion) -> {:ok, emotion}
      nil -> {:error, ErrorCat.unknown_emotion()}
    end
  end

  def decode(_value, _type), do: {:error, ErrorCat.unknown_emotion()}

  defp change_fact(%Comment{} = comment, _info, emotion, actor, :add) do
    insert_fact(
      CommentUserEmotion,
      %{
        comment_id: comment.id,
        received_user_id: comment.author_id,
        user_id: actor.id,
        emotion: to_string(emotion)
      },
      [:comment_id, :user_id, :emotion]
    )
  end

  defp change_fact(%Comment{} = comment, _info, emotion, actor, :remove) do
    delete_fact(
      from(row in CommentUserEmotion,
        where:
          row.comment_id == ^comment.id and row.user_id == ^actor.id and
            row.emotion == ^to_string(emotion)
      )
    )
  end

  defp change_fact(article, info, emotion, actor, :add) do
    attrs =
      %{
        received_user_id: author_user_id(article),
        user_id: actor.id,
        emotion: to_string(emotion)
      }
      |> Map.put(info.foreign_key, article.id)

    conflict_target =
      {:unsafe_fragment,
       "(user_id, #{info.foreign_key}, emotion) WHERE #{info.foreign_key} IS NOT NULL"}

    insert_fact(ArticleUserEmotion, attrs, conflict_target)
  end

  defp change_fact(article, info, emotion, actor, :remove) do
    foreign_key = info.foreign_key

    delete_fact(
      from(row in ArticleUserEmotion,
        where:
          field(row, ^foreign_key) == ^article.id and row.user_id == ^actor.id and
            row.emotion == ^to_string(emotion)
      )
    )
  end

  defp insert_fact(schema, attrs, conflict_target) do
    now = DateTime.utc_now(:second)
    attrs = Map.merge(attrs, %{inserted_at: now, updated_at: now})

    case Repo.insert_all(schema, [attrs],
           on_conflict: :nothing,
           conflict_target: conflict_target
         ) do
      {1, _rows} -> {:ok, :changed}
      {0, _rows} -> {:ok, :unchanged}
      _ -> {:error, ErrorCat.interaction_state_conflict("unexpected emotion insert result")}
    end
  end

  defp delete_fact(query) do
    case Repo.delete_all(query) do
      {1, _rows} -> {:ok, :changed}
      {0, _rows} -> {:ok, :unchanged}
      _ -> {:error, ErrorCat.interaction_state_conflict("multiple emotion facts deleted")}
    end
  end

  defp author_user_id(%{author: %{user_id: user_id}}), do: user_id
  defp author_user_id(%{author_id: author_id}), do: Repo.get!(Author, author_id).user_id
end
