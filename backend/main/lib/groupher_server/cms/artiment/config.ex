defmodule GroupherServer.CMS.Artiment.Config do
  @moduledoc """
  Static configuration contract for CMS artiments.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Config
        -> Repo / domain event
  """

  @article_config Application.compile_env(:groupher_server, :article, [])

  @type t :: %__MODULE__{
          threads: [atom()],
          min_length: non_neg_integer(),
          max_length: pos_integer(),
          active_period_days: map(),
          max_upvoted_users_count: non_neg_integer(),
          emotions: [atom()],
          comment_emotions: [atom()],
          emotions_whitelist: [atom()],
          default_thread_emotions: map(),
          digest_length: pos_integer(),
          archive_threshold: map()
        }

  defstruct threads: Keyword.get(@article_config, :threads, []),
            min_length: Keyword.get(@article_config, :min_length),
            max_length: Keyword.get(@article_config, :max_length),
            active_period_days: Keyword.get(@article_config, :active_period_days, %{}),
            max_upvoted_users_count: Keyword.get(@article_config, :max_upvoted_users_count),
            emotions: Keyword.get(@article_config, :emotions, []),
            comment_emotions: Keyword.get(@article_config, :comment_emotions, []),
            emotions_whitelist: Keyword.get(@article_config, :emotions_whitelist, []),
            default_thread_emotions: Keyword.get(@article_config, :default_thread_emotions, %{}),
            digest_length: Keyword.get(@article_config, :digest_length),
            archive_threshold: Keyword.get(@article_config, :archive_threshold, %{})

  @doc "Returns a `%Config{}` struct populated with the configured article defaults."
  @spec base() :: t()
  def base, do: %__MODULE__{}

  @doc "Returns the configured article thread atoms."
  @spec threads() :: [atom()]
  def threads, do: base().threads

  @doc "Returns the minimum plain-text length accepted for article bodies."
  @spec min_length() :: non_neg_integer()
  def min_length, do: base().min_length

  @doc "Returns the maximum plain-text length accepted for article bodies."
  @spec max_length() :: pos_integer()
  def max_length, do: base().max_length

  @doc "Returns the active-period day window per thread used for recency checks."
  @spec active_period_days() :: map()
  def active_period_days, do: base().active_period_days

  @doc "Returns the maximum count of upvoted users kept for article display."
  @spec max_upvoted_users_count() :: non_neg_integer()
  def max_upvoted_users_count, do: base().max_upvoted_users_count

  @doc "Returns the emotions enabled for article reactions."
  @spec emotions() :: [atom()]
  def emotions, do: base().emotions

  @doc "Returns the emotions enabled for comment reactions."
  @spec comment_emotions() :: [atom()]
  def comment_emotions, do: base().comment_emotions

  @doc "Returns the emotion whitelist allowed for community reactions."
  @spec emotions_whitelist() :: [atom()]
  def emotions_whitelist, do: base().emotions_whitelist

  @doc "Returns the default emotion set per thread."
  @spec default_thread_emotions() :: map()
  def default_thread_emotions, do: base().default_thread_emotions

  @doc "Returns the digest length used when building article and comment digests."
  @spec digest_length() :: pos_integer()
  def digest_length, do: base().digest_length

  @doc "Returns the per-thread archive thresholds used by the archiving job."
  @spec archive_threshold() :: map()
  def archive_threshold, do: base().archive_threshold
end
