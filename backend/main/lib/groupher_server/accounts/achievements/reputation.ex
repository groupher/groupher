defmodule GroupherServer.Accounts.Achievements.Reputation do
  @moduledoc false

  import Helper.Utils, only: [get_config: 2]
  import ShortMaps

  alias GroupherServer.Accounts.Model.{Achievement, User}
  alias Helper.{ORM, Transaction}

  @collect_weight get_config(:general, :user_achieve_collect_weight)
  @upvote_weight get_config(:general, :user_achieve_upvote_weight)
  @follow_weight get_config(:general, :user_achieve_follow_weight)

  def achieve(%User{id: user_id}, :inc, :follow) do
    update_achievement_counter(user_id, fn achievement ->
      followers_count = achievement.followers_count + 1
      reputation = achievement.reputation + @follow_weight
      ~m(followers_count reputation)a
    end)
  end

  def achieve(%User{id: user_id}, :dec, :follow) do
    update_achievement_counter(user_id, fn achievement ->
      followers_count = max(achievement.followers_count - 1, 0)
      reputation = max(achievement.reputation - @follow_weight, 0)
      ~m(followers_count reputation)a
    end)
  end

  def achieve(%User{id: user_id}, :inc, :upvote) do
    update_achievement_counter(user_id, fn achievement ->
      articles_upvotes_count = achievement.articles_upvotes_count + 1
      reputation = achievement.reputation + @upvote_weight
      ~m(articles_upvotes_count reputation)a
    end)
  end

  def achieve(%User{id: user_id}, :dec, :upvote) do
    update_achievement_counter(user_id, fn achievement ->
      articles_upvotes_count = max(achievement.articles_upvotes_count - 1, 0)
      reputation = max(achievement.reputation - @upvote_weight, 0)
      ~m(articles_upvotes_count reputation)a
    end)
  end

  def achieve(%User{id: user_id}, :inc, :collect) do
    update_achievement_counter(user_id, fn achievement ->
      articles_collects_count = achievement.articles_collects_count + 1
      reputation = achievement.reputation + @collect_weight
      ~m(articles_collects_count reputation)a
    end)
  end

  def achieve(%User{id: user_id}, :dec, :collect) do
    update_achievement_counter(user_id, fn achievement ->
      articles_collects_count = max(achievement.articles_collects_count - 1, 0)
      reputation = max(achievement.reputation - @collect_weight, 0)
      ~m(articles_collects_count reputation)a
    end)
  end

  def downgrade_achievement(%User{id: user_id}, :collect, count) do
    Transaction.lock_global("achievement:user:#{user_id}", fn ->
      with {:ok, achievement} <- ORM.find_by(Achievement, user_id: user_id) do
        articles_collects_count = max(achievement.articles_collects_count - count, 0)
        reputation = max(achievement.reputation - count * @collect_weight, 0)

        achievement |> ORM.update(~m(articles_collects_count reputation)a)
      end
    end)
    |> case do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, reason}
    end
  end

  defp update_achievement_counter(user_id, updater) when is_function(updater, 1) do
    Transaction.lock_global("achievement:user:#{user_id}", fn ->
      with {:ok, _} <- ORM.upsert_by(Achievement, ~m(user_id)a, ~m(user_id)a),
           {:ok, achievement} <- ORM.find_by(Achievement, ~m(user_id)a),
           attrs <- updater.(achievement) do
        achievement |> ORM.update(attrs)
      end
    end)
    |> case do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, reason}
    end
  end
end
