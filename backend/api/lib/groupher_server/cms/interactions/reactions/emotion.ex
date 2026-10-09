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

  alias GroupherServer.{Accounts, Analysis, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.Articles.Bindings
  alias CMS.Communities.Enable
  alias CMS.{Gate, Command}
  alias CMS.Interactions.{Config, ErrorCat, ReadState}
  alias CMS.Interactions.Reactions.EmotionConfirmation, as: Confirmation
  alias CMS.Model.{ArticleUserEmotion, Author, Comment, CommentUserEmotion}
  alias Analysis.MetricEvent
  alias Helper.T

  @reserved_article_emotions [:upvote, :collect]

  @doc """
  Applies an emotion as an idempotent set-state command.

  ## Examples

      Reactions.Emotion.add(comment, :heart, actor)

  """
  @spec add(struct(), atom(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def add(artiment, emotion, %User{} = actor, command_id) do
    mutate(artiment, emotion, actor, :add, command_id)
  end

  @doc """
  Removes an emotion as an idempotent set-state command.

  ## Examples

      Reactions.Emotion.remove(comment, :heart, actor)

  """
  @spec remove(struct(), atom(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def remove(artiment, emotion, %User{} = actor, command_id) do
    mutate(artiment, emotion, actor, :remove, command_id)
  end

  defp mutate(input, emotion, actor, operation, command_id) when is_atom(emotion) do
    with {:ok, command_id} <- require_command_id(command_id),
         {:ok, info} <- Matcher.match_interaction(input) do
      result =
        %Command{
          actor: actor,
          command_id: command_id,
          operation: emotion_command(operation),
          target: input,
          params: %{operation: operation, emotion: emotion}
        }
        |> Command.execute(action: &emotion_action(&1, info), confirmation: Confirmation)

      present_reaction(result, input, command_id)
    end
  end

  defp mutate(_input, emotion, _actor, _operation, _command_id) do
    {:error, ErrorCat.emotion_not_allowed(inspect(emotion))}
  end

  defp emotion_action(
         %{
           actor: actor,
           target: input,
           params: %{operation: operation, emotion: emotion},
           command_id: command_id
         },
         info
       ) do
    with {:ok, canonical} <- Gate.access_check(actor, :emotion, input),
         {:ok, _thread_key} <- allow_emotion(canonical, info, emotion),
         {:ok, change} <- change_fact(canonical, info, emotion, actor, operation),
         {:ok, _} <- sync_state(canonical, emotion, actor, operation, change),
         {:ok, _} <- record_metric(canonical, operation, change, command_id),
         {:ok, _} <- enqueue_effect(canonical, actor, operation, emotion, command_id, change) do
      {:ok,
       %Confirmation{
         data: %{
           "target_id" => to_string(canonical.id),
           "target_type" => interaction_resource_type(canonical),
           "operation" => Atom.to_string(operation),
           "emotion" => Atom.to_string(emotion),
           "outcome" => Atom.to_string(change)
         }
       }}
    end
  end

  defp require_command_id(command_id) when is_binary(command_id), do: {:ok, command_id}
  defp require_command_id(_command_id), do: {:error, CMS.ErrorCat.command_id_required()}

  defp enqueue_effect(_canonical, _actor, _operation, _emotion, _command_id, :unchanged) do
    {:ok, :pass}
  end

  defp enqueue_effect(canonical, actor, operation, emotion, command_id, :changed) do
    CMS.Outbox.send(%{
      event: "interaction.emotion_changed",
      worker: CMS.Outbox.Workers.Interaction.Cleanup,
      resource_type: interaction_resource_type(canonical),
      resource_id: canonical.id,
      command_id: command_id,
      data: %{actor_id: actor.id, operation: operation, emotion: emotion}
    })
    |> case do
      {:ok, _event} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end

  defp interaction_resource_type(%Comment{}), do: "comment"
  defp interaction_resource_type(_article), do: "article"

  defp emotion_command(:add), do: :emotion_add
  defp emotion_command(:remove), do: :emotion_remove

  defp allow_emotion(%Comment{} = comment, _info, emotion) do
    Enable.emotion?(comment.community.slug, :comment, comment.thread, emotion)
  end

  defp allow_emotion(_article, _info, emotion) when emotion in @reserved_article_emotions do
    {:error, ErrorCat.emotion_not_allowed(inspect(emotion))}
  end

  defp allow_emotion(article, info, emotion) do
    case Bindings.get(article, Map.get(article, :community)) do
      {:ok, %{community: community}} ->
        Enable.emotion?(community.slug, :article, info.artiment, emotion)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp sync_state(_canonical, _emotion, _actor, _operation, :unchanged), do: {:ok, :pass}

  defp sync_state(canonical, emotion, actor, operation, :changed) do
    result =
      if operation == :add,
        do: ReadState.add_emotion(canonical, emotion, actor),
        else: ReadState.remove_emotion(canonical, emotion, actor)

    case result do
      {:ok, _projection} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp record_metric(%Comment{}, _operation, _change, _operation_id), do: {:ok, :pass}
  defp record_metric(_article, _operation, :unchanged, _operation_id), do: {:ok, :pass}

  defp record_metric(article, operation, :changed, operation_id) do
    metric = if operation == :add, do: :emotion_added, else: :emotion_removed

    case MetricEvent.append_article_action(article, operation_id, metric) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp present_reaction({:ok, %Confirmation{data: data}}, input, command_id) do
    outcome = if data["outcome"] == "unchanged", do: :unchanged, else: :changed
    {:ok, put_reaction_metadata(input, command_id, outcome)}
  end

  defp present_reaction({:ok, data}, input, command_id) when is_map(data) do
    present_reaction({:ok, %Confirmation{data: data}}, input, command_id)
  end

  defp present_reaction(error, _input, _command_id), do: error

  defp put_reaction_metadata(canonical, command_id, outcome) do
    canonical
    |> Map.put(:command_id, command_id)
    |> Map.put(:reaction_outcome, outcome)
  end

  @doc """
  Safely decodes a persisted emotion using the bounded vocabulary.

  ## Examples

      Reactions.Emotion.decode("heart", :article)
      #=> {:ok, :heart}

  """
  @spec decode(String.t(), :article | :comment) ::
          {:ok, atom()} | {:error, ErrorCat.error()}
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

    conflict_target = emotion_conflict_target(info.foreign_key)

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

  defp emotion_conflict_target(:article_id) do
    {:unsafe_fragment,
     "(user_id, article_id, emotion) WHERE article_id IS NOT NULL AND branch_id IS NULL"}
  end

  defp emotion_conflict_target(foreign_key) do
    {:unsafe_fragment, "(user_id, #{foreign_key}, emotion) WHERE #{foreign_key} IS NOT NULL"}
  end
end
