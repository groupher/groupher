defmodule GroupherServer.CMS.Interactions.Reactions.Emotion do
  @moduledoc """
  Owns the complete idempotent Article and Comment emotion flow.

      CMS.Interactions
        -> Gate canonical Artiment
        -> allowed emotion
        -> emotion fact changed/unchanged
        -> Interaction State in the same transaction
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.Articles.Bindings
  alias CMS.Communities.Enable
  alias CMS.Gate
  alias CMS.Interactions.{Config, Effects, ErrorCat, Persist, Projection}
  alias CMS.Interactions.Reactions.EmotionConfirmation, as: Confirmation
  alias CMS.Model.{ArticleUserEmotion, Author, Comment, CommentUserEmotion}

  alias Helper.T

  @reserved_article_emotions [:upvote, :collect]

  @doc """
  Applies an emotion as an idempotent set-state command.

  ## Examples

      Reactions.Emotion.add(comment, :heart, actor)

  """
  @spec add(struct(), atom(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def add(artiment, emotion, %User{} = actor, command_id) do
    execute_add(artiment, emotion, :add, actor, command_id)
  end

  @doc """
  Removes an emotion as an idempotent set-state command.

  ## Examples

      Reactions.Emotion.remove(comment, :heart, actor)

  """
  @spec remove(struct(), atom(), User.t(), Ecto.UUID.t()) :: T.domain_res(struct())
  def remove(artiment, emotion, %User{} = actor, command_id) do
    execute_remove(artiment, emotion, :remove, actor, command_id)
  end

  @pipeline operation: :emotion_add,
            confirmation: Confirmation,
            target: :input,
            params: [:emotion, :operation]

  receipt_pipeline execute_add(input, emotion, operation, actor, command_id) do
    prepare(fn -> prepare_emotion(input, emotion) end)
    gate(fn info -> gate_target(input, info, actor) end)

    change(fn {canonical, info} ->
      change_emotion(canonical, info, emotion, actor, operation, command_id)
    end)

    confirm(fn {canonical, change} -> confirmation(canonical, emotion, operation, change) end)
    present(fn confirmation -> present_reaction(confirmation, input, command_id) end)
  end

  @pipeline operation: :emotion_remove,
            confirmation: Confirmation,
            target: :input,
            params: [:emotion, :operation]

  receipt_pipeline execute_remove(input, emotion, operation, actor, command_id) do
    prepare(fn -> prepare_emotion(input, emotion) end)
    gate(fn info -> gate_target(input, info, actor) end)

    change(fn {canonical, info} ->
      change_emotion(canonical, info, emotion, actor, operation, command_id)
    end)

    confirm(fn {canonical, change} -> confirmation(canonical, emotion, operation, change) end)
    present(fn confirmation -> present_reaction(confirmation, input, command_id) end)
  end

  defp prepare_emotion(input, emotion) when is_atom(emotion) do
    Matcher.match_interaction(input)
  end

  defp prepare_emotion(_input, emotion) do
    {:error, ErrorCat.emotion_not_allowed(inspect(emotion))}
  end

  defp gate_target(input, info, actor) do
    with {:ok, canonical} <- Gate.check_interaction_in_transaction(actor, :emotion, input) do
      {:ok, {canonical, info}}
    end
  end

  defp change_emotion(canonical, info, emotion, actor, operation, command_id) do
    with {:ok, _thread_key} <- allow_emotion(canonical, info, emotion),
         {:ok, change} <- change_fact(canonical, info, emotion, actor, operation),
         {:ok, _} <- sync_state(canonical, emotion, actor, operation, change),
         {:ok, _} <- record_metric(canonical, operation, change, command_id),
         {:ok, _} <- enqueue_effect(canonical, actor, operation, emotion, command_id, change) do
      {:ok, {canonical, change}}
    end
  end

  defp confirmation(canonical, emotion, operation, change) do
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

  defp enqueue_effect(_canonical, _actor, _operation, _emotion, _command_id, :unchanged) do
    {:ok, :pass}
  end

  defp enqueue_effect(canonical, actor, operation, emotion, command_id, :changed) do
    with {:ok, data} <-
           Effects.reaction_data(canonical, %{
             actor_id: actor.id,
             operation: operation,
             emotion: emotion
           }) do
      Effects.enqueue_reaction_changed(
        "interaction.emotion_changed",
        interaction_resource_type(canonical),
        canonical.id,
        command_id,
        data
      )
    end
  end

  defp interaction_resource_type(%Comment{}), do: "comment"
  defp interaction_resource_type(_article), do: "article"

  defp allow_emotion(%Comment{} = comment, _info, emotion) do
    case comment.request_community_slug do
      slug when is_binary(slug) -> Enable.emotion?(slug, :comment, comment.thread, emotion)
      _ -> {:error, CMS.Gate.ErrorCat.scope_context_missing()}
    end
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
        do: Projection.add_emotion(canonical, emotion, actor),
        else: Projection.remove_emotion(canonical, emotion, actor)

    case result do
      {:ok, _projection} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp record_metric(%Comment{}, _operation, _change, _operation_id), do: {:ok, :pass}
  defp record_metric(_article, _operation, :unchanged, _operation_id), do: {:ok, :pass}

  defp record_metric(article, operation, :changed, operation_id) do
    metric = if operation == :add, do: :emotion_added, else: :emotion_removed

    case GroupherServer.Analysis.metric_event_append_article_action(article, operation_id, metric) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp present_reaction(%Confirmation{data: data}, input, command_id) do
    outcome = if data["outcome"] == "unchanged", do: :unchanged, else: :changed
    {:ok, put_reaction_metadata(input, command_id, outcome)}
  end

  defp present_reaction(data, input, command_id) when is_map(data) do
    present_reaction(%Confirmation{data: data}, input, command_id)
  end

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
    Persist.insert_fact(
      CommentUserEmotion,
      %{
        comment_id: comment.id,
        received_user_id: comment.author_id,
        user_id: actor.id,
        emotion: to_string(emotion)
      },
      [:comment_id, :user_id, :emotion],
      "emotion"
    )
  end

  defp change_fact(%Comment{} = comment, _info, emotion, actor, :remove) do
    Persist.delete_fact(
      from(row in CommentUserEmotion,
        where:
          row.comment_id == ^comment.id and row.user_id == ^actor.id and
            row.emotion == ^to_string(emotion)
      ),
      "emotion"
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

    Persist.insert_fact(ArticleUserEmotion, attrs, conflict_target, "emotion")
  end

  defp change_fact(article, info, emotion, actor, :remove) do
    foreign_key = info.foreign_key

    Persist.delete_fact(
      from(row in ArticleUserEmotion,
        where:
          field(row, ^foreign_key) == ^article.id and row.user_id == ^actor.id and
            row.emotion == ^to_string(emotion)
      ),
      "emotion"
    )
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
