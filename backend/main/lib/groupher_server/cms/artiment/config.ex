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

  @spec base() :: t()
  def base, do: %__MODULE__{}

  @spec threads() :: [atom()]
  def threads, do: base().threads

  @spec min_length() :: non_neg_integer()
  def min_length, do: base().min_length

  @spec max_length() :: pos_integer()
  def max_length, do: base().max_length

  @spec active_period_days() :: map()
  def active_period_days, do: base().active_period_days

  @spec max_upvoted_users_count() :: non_neg_integer()
  def max_upvoted_users_count, do: base().max_upvoted_users_count

  @spec emotions() :: [atom()]
  def emotions, do: base().emotions

  @spec comment_emotions() :: [atom()]
  def comment_emotions, do: base().comment_emotions

  @spec emotions_whitelist() :: [atom()]
  def emotions_whitelist, do: base().emotions_whitelist

  @spec default_thread_emotions() :: map()
  def default_thread_emotions, do: base().default_thread_emotions

  @spec digest_length() :: pos_integer()
  def digest_length, do: base().digest_length

  @spec archive_threshold() :: map()
  def archive_threshold, do: base().archive_threshold
end
