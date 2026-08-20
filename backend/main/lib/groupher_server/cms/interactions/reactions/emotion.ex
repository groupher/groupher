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

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.Articles.MutationLock
  alias CMS.Communities.Enable
  alias CMS.Interactions.{Config, ErrorCat, ReadState}
  alias CMS.Model.{ArticleUserEmotion, Author, Comment, CommentUserEmotion}
  alias CMS.{Events, Gate}
  alias Helper.{Later, T}

  @doc """
  Applies an emotion as an idempotent set-state command.

  ## Examples

      Reactions.Emotion.add(comment, :heart, actor)

  """
  @spec add(struct(), atom(), User.t()) :: T.domain_res(struct())
  def add(artiment, emotion, %User{} = actor), do: mutate(artiment, emotion, actor, :add)

  @doc """
  Removes an emotion as an idempotent set-state command.

  ## Examples

      Reactions.Emotion.remove(comment, :heart, actor)

  """
  @spec remove(struct(), atom(), User.t()) :: T.domain_res(struct())
  def remove(artiment, emotion, %User{} = actor),
    do: mutate(artiment, emotion, actor, :remove)

  defp mutate(input, emotion, actor, operation) when is_atom(emotion) do
    MutationLock.observe_transaction(fn ->
      Repo.transaction(fn ->
        with {:ok, canonical} <- Gate.access_check(actor, :emotion, input),
             {:ok, info} <- Matcher.match_interaction(canonical),
             {:ok, _thread_key} <- allow_emotion(canonical, info, emotion),
             {:ok, change} <- change_fact(canonical, info, emotion, actor, operation),
             :ok <- sync_state(canonical, emotion, actor, operation, change) do
          {canonical, change}
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end)
    |> after_commit(operation, actor)
  end

  defp mutate(_input, emotion, _actor, _operation),
    do: {:error, ErrorCat.emotion_not_allowed(inspect(emotion))}

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

  defp after_commit({:ok, {canonical, :changed}}, :add, actor) do
    if match?(%Comment{}, canonical) do
      Later.run({Events, :emit, [:subscribe_community, %{target: canonical, user: actor}]})
    end

    {:ok, canonical}
  end

  defp after_commit({:ok, {canonical, _change}}, _operation, _actor), do: {:ok, canonical}
  defp after_commit({:error, reason}, _operation, _actor), do: {:error, reason}

  @doc """
  Safely decodes a persisted emotion using the bounded vocabulary.

  ## Examples

      Reactions.Emotion.decode("heart", :article)
      #=> {:ok, :heart}

  """
  @spec decode(String.t(), :article | :comment) ::
          {:ok, atom()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def decode(value, kind) when is_binary(value) and kind in [:article, :comment] do
    vocabulary = if kind == :article, do: Config.emotions(), else: Config.comment_emotions()

    case Enum.find(vocabulary, &(Atom.to_string(&1) == value)) do
      emotion when is_atom(emotion) and not is_nil(emotion) -> {:ok, emotion}
      nil -> {:error, ErrorCat.unknown_emotion()}
    end
  end

  def decode(_value, _kind), do: {:error, ErrorCat.unknown_emotion()}

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
