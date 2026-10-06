defmodule GroupherServer.CMS.Interactions.ReadState do
  @moduledoc """
  Routes reads and internal synchronization for derived Interaction state.

  `ReadState` is rebuildable from reaction facts and durable view events. This
  facade contains no Ecto queries or projection mutation logic.

      CMS.Interactions -> ReadState -> Query / Sync
  """

  alias __MODULE__.{Query, Sync}
  alias GroupherServer.Accounts
  alias Accounts.Model.User

  @doc """
  Returns Interaction state for one Artiment and optional viewer.

  ## Examples

      ReadState.viewer_state(article, viewer)

  """
  @spec viewer_state(struct(), User.t() | nil, keyword()) :: map() | {:error, term()}
  defdelegate viewer_state(artiment, viewer, opts \\ []), to: Query

  @doc """
  Returns Interaction states keyed by `{artiment_type, physical_id}`.

  ## Examples

      ReadState.viewer_states([article, comment], viewer)

  """
  @spec viewer_states([struct()], User.t() | nil, keyword()) :: map() | {:error, term()}
  defdelegate viewer_states(artiments, viewer, opts \\ []), to: Query

  @doc "Resolves public Article paths and returns ordered private Interaction state."
  defdelegate article_states_for_paths(paths, viewer, opts \\ []), to: Query

  @doc "Maps an already-read Article locator and private Interaction state without IO."
  @spec article_state(map(), map()) :: map()
  def article_state(article, interaction) do
    %{
      community: article.community,
      thread: article.thread,
      inner_id: article.inner_id,
      interaction_revision: interaction.interaction_revision || 0,
      viewer_has_upvoted: interaction.viewer_has_upvoted || false,
      viewer_has_collected: interaction.viewer_has_collected || false,
      viewer_emotion: interaction.viewer_emotion
    }
  end

  @doc "Returns public Interaction presentation state for one Artiment."
  defdelegate public_state(artiment, opts \\ []), to: Query

  @doc "Returns batched public Interaction presentation state."
  defdelegate public_states(artiments, opts \\ []), to: Query

  @doc """
  Returns lightweight fixed counts keyed by Artiment identity.

  ## Examples

      ReadState.counts([article, comment])

  """
  @spec counts([struct()]) :: map() | {:error, term()}
  defdelegate counts(artiments), to: Query

  @doc """
  Applies a changed upvote fact to derived read state.

  ## Examples

      ReadState.add_upvote(article, actor)

  """
  @spec add_upvote(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  defdelegate add_upvote(artiment, actor), to: Sync

  @doc """
  Removes a changed upvote fact from derived read state.

  ## Examples

      ReadState.remove_upvote(article, actor)

  """
  @spec remove_upvote(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  defdelegate remove_upvote(artiment, actor), to: Sync

  @doc """
  Applies a changed collect fact to derived read state.

  ## Examples

      ReadState.add_collect(article, actor)

  """
  @spec add_collect(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  defdelegate add_collect(article, actor), to: Sync

  @doc """
  Removes a changed collect fact from derived read state.

  ## Examples

      ReadState.remove_collect(article, actor)

  """
  @spec remove_collect(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  defdelegate remove_collect(article, actor), to: Sync

  @doc """
  Applies a changed emotion fact to derived read state.

  ## Examples

      ReadState.add_emotion(article, :heart, actor)

  """
  @spec add_emotion(struct(), atom(), User.t()) :: {:ok, map()} | {:error, term()}
  defdelegate add_emotion(artiment, emotion, actor), to: Sync

  @doc """
  Removes a changed emotion fact from derived read state.

  ## Examples

      ReadState.remove_emotion(article, :heart, actor)

  """
  @spec remove_emotion(struct(), atom(), User.t()) :: {:ok, map()} | {:error, term()}
  defdelegate remove_emotion(artiment, emotion, actor), to: Sync

  @doc """
  Applies a changed report fact to derived read state.

  ## Examples

      ReadState.add_report(article, actor)

  """
  @spec add_report(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  defdelegate add_report(artiment, actor), to: Sync

  @doc """
  Removes a changed report fact from derived read state.

  ## Examples

      ReadState.remove_report(article, actor)

  """
  @spec remove_report(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  defdelegate remove_report(artiment, actor), to: Sync
end
