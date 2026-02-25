defmodule GroupherServer.Accounts.Achievements.Reputation do
  @moduledoc false

  import Helper.Utils, only: [get_config: 2]
  import ShortMaps

  alias GroupherServer.Accounts.Model.{Achievement, User}
  alias Helper.ORM

  @collect_weight get_config(:general, :user_achieve_collect_weight)
  @upvote_weight get_config(:general, :user_achieve_upvote_weight)
  @follow_weight get_config(:general, :user_achieve_follow_weight)

  def achieve(%User{id: user_id}, :inc, :follow) do
    with {:ok, achievement} <- ORM.findby_or_insert(Achievement, ~m(user_id)a, ~m(user_id)a) do
      followers_count = achievement.followers_count + 1
      reputation = achievement.reputation + @follow_weight

      achievement
      |> ORM.update(~m(followers_count reputation)a)
    end
  end

  def achieve(%User{id: user_id}, :dec, :follow) do
    with {:ok, achievement} <- ORM.findby_or_insert(Achievement, ~m(user_id)a, ~m(user_id)a) do
      followers_count = max(achievement.followers_count - 1, 0)
      reputation = max(achievement.reputation - @follow_weight, 0)

      achievement
      |> ORM.update(~m(followers_count reputation)a)
    end
  end

  def achieve(%User{id: user_id}, :inc, :upvote) do
    with {:ok, achievement} <- ORM.findby_or_insert(Achievement, ~m(user_id)a, ~m(user_id)a) do
      articles_upvotes_count = achievement.articles_upvotes_count + 1
      reputation = achievement.reputation + @upvote_weight

      achievement
      |> ORM.update(~m(articles_upvotes_count reputation)a)
    end
  end

  def achieve(%User{id: user_id}, :dec, :upvote) do
    with {:ok, achievement} <- ORM.findby_or_insert(Achievement, ~m(user_id)a, ~m(user_id)a) do
      articles_upvotes_count = max(achievement.articles_upvotes_count - 1, 0)
      reputation = max(achievement.reputation - @upvote_weight, 0)

      achievement
      |> ORM.update(~m(articles_upvotes_count reputation)a)
    end
  end

  def achieve(%User{id: user_id}, :inc, :collect) do
    with {:ok, achievement} <- ORM.findby_or_insert(Achievement, ~m(user_id)a, ~m(user_id)a) do
      articles_collects_count = achievement.articles_collects_count + 1
      reputation = achievement.reputation + @collect_weight

      achievement
      |> ORM.update(~m(articles_collects_count reputation)a)
    end
  end

  def achieve(%User{id: user_id}, :dec, :collect) do
    with {:ok, achievement} <- ORM.findby_or_insert(Achievement, ~m(user_id)a, ~m(user_id)a) do
      articles_collects_count = max(achievement.articles_collects_count - 1, 0)
      reputation = max(achievement.reputation - @collect_weight, 0)

      achievement
      |> ORM.update(~m(articles_collects_count reputation)a)
    end
  end

  def downgrade_achievement(%User{id: user_id}, :collect, count) do
    with {:ok, achievement} <- ORM.find_by(Achievement, user_id: user_id) do
      articles_collects_count = max(achievement.articles_collects_count - count, 0)
      reputation = max(achievement.reputation - count * @collect_weight, 0)

      achievement |> ORM.update(~m(articles_collects_count reputation)a)
    end
  end
end
