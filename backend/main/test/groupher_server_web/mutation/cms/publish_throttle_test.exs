defmodule GroupherServer.Test.Mutation.PublishThrottle do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Gate.ErrorCat

  @throttle_interval GroupherServer.CMS.Policy.Config.publish_throttle().interval_minutes
  @hour_limit GroupherServer.CMS.Policy.Config.publish_throttle().hour_limit
  @day_total GroupherServer.CMS.Policy.Config.publish_throttle().day_limit

  setup do
    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)

    {:ok, community} = mock_community()

    {:ok, ~m(user_conn guest_conn community)a}
  end

  test "user first create content should success", ~m(community)a do
    {:ok, user} = db_insert(:user)
    user_conn = simu_conn(:user, user)

    variables = mock_attrs(:post) |> Map.merge(%{community: community.slug})

    created = user_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)

    assert created |> Map.has_key?("innerId")
  end

  test "user create 2 content with valid interval time success", ~m(community)a do
    {:ok, user} = db_insert(:user)
    user_conn = simu_conn(:user, user)

    variables = mock_attrs(:post) |> Map.merge(%{community: community.slug})

    created = user_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)

    assert created |> Map.has_key?("innerId")

    CMS.Policy.mock_publish_throttle_attr(
      :last_publish_time,
      %User{id: user.id},
      minutes: -@throttle_interval
    )

    created = user_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)

    assert created |> Map.has_key?("innerId")
  end

  test "god create multi content with invalid interval time success", ~m(community)a do
    {:ok, user} = db_insert(:user)
    passport_rules = %{"god" => true}
    rule_conn = simu_conn(:user, cms: passport_rules)
    variables = mock_attrs(:post) |> Map.merge(%{community: community.slug})

    created = rule_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)
    assert created |> Map.has_key?("innerId")

    created = rule_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)
    assert created |> Map.has_key?("innerId")

    CMS.Policy.mock_publish_throttle_attr(
      :last_publish_time,
      %User{id: user.id},
      minutes: -(@throttle_interval - 1)
    )

    created = rule_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)
    assert created |> Map.has_key?("innerId")
  end

  test "user create multi content with invalid interval time", ~m(community)a do
    {:ok, user} = db_insert(:user)
    user_conn = simu_conn(:user, user)
    variables = mock_attrs(:post) |> Map.merge(%{community: community.slug})

    created =
      user_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)

    assert created |> Map.has_key?("innerId")

    assert user_conn
           |> mutation_error?(
             S.Article.m(:create_article, :post),
             variables,
             ErrorCat.code(ErrorCat.throttle_interval())
           )

    CMS.Policy.mock_publish_throttle_attr(
      :last_publish_time,
      %User{id: user.id},
      minutes: -(@throttle_interval - 1)
    )

    assert user_conn
           |> mutation_error?(
             S.Article.m(:create_article, :post),
             variables,
             ErrorCat.code(ErrorCat.throttle_interval())
           )
  end

  test "user create multi content with invalid hour_count fails", ~m(community)a do
    {:ok, user} = db_insert(:user)
    user_conn = simu_conn(:user, user)

    variables = mock_attrs(:post) |> Map.merge(%{community: community.slug})

    created = user_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)

    assert created |> Map.has_key?("innerId")

    CMS.Policy.mock_publish_throttle_attr(
      :last_publish_time,
      %User{id: user.id},
      minutes: -@throttle_interval
    )

    CMS.Policy.mock_publish_throttle_attr(
      :hour_count,
      %User{id: user.id},
      count: @hour_limit
    )

    assert user_conn
           |> mutation_error?(
             S.Article.m(:create_article, :post),
             variables,
             ErrorCat.code(ErrorCat.throttle_hour())
           )
  end

  test "user create multi content with valid hour count success in next hour", ~m(community)a do
    {:ok, user} = db_insert(:user)
    user_conn = simu_conn(:user, user)

    variables = mock_attrs(:post) |> Map.merge(%{community: community.slug})

    created = user_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)

    assert created |> Map.has_key?("innerId")

    CMS.Policy.mock_publish_throttle_attr(
      :last_publish_time,
      %User{id: user.id},
      minutes: -@throttle_interval
    )

    CMS.Policy.mock_publish_throttle_attr(
      :hour_count,
      %User{id: user.id},
      count: @hour_limit
    )

    assert user_conn
           |> mutation_error?(
             S.Article.m(:create_article, :post),
             variables,
             ErrorCat.code(ErrorCat.throttle_hour())
           )

    CMS.Policy.mock_publish_throttle_attr(
      :publish_hour,
      %User{id: user.id},
      hours: -1
    )

    created =
      user_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)

    assert created |> Map.has_key?("innerId")
  end

  test "user create multi content with invalid day_count fails", ~m(community)a do
    {:ok, user} = db_insert(:user)
    user_conn = simu_conn(:user, user)

    variables = mock_attrs(:post) |> Map.merge(%{community: community.slug})

    created =
      user_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)

    assert created |> Map.has_key?("innerId")

    CMS.Policy.mock_publish_throttle_attr(
      :last_publish_time,
      %User{id: user.id},
      minutes: -@throttle_interval
    )

    CMS.Policy.mock_publish_throttle_attr(
      :date_count,
      %User{id: user.id},
      count: @day_total
    )

    assert user_conn
           |> mutation_error?(
             S.Article.m(:create_article, :post),
             variables,
             ErrorCat.code(ErrorCat.throttle_day())
           )
  end

  test "user create multi content with valid day count success in next day", ~m(community)a do
    {:ok, user} = db_insert(:user)
    user_conn = simu_conn(:user, user)

    variables = mock_attrs(:post) |> Map.merge(%{community: community.slug})

    created = user_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)

    assert created |> Map.has_key?("innerId")

    CMS.Policy.mock_publish_throttle_attr(
      :last_publish_time,
      %User{id: user.id},
      minutes: -@throttle_interval
    )

    CMS.Policy.mock_publish_throttle_attr(
      :date_count,
      %User{id: user.id},
      count: @day_total
    )

    assert user_conn
           |> mutation_error?(
             S.Article.m(:create_article, :post),
             variables,
             ErrorCat.code(ErrorCat.throttle_day())
           )

    CMS.Policy.mock_publish_throttle_attr(
      :publish_date,
      %User{id: user.id},
      days: -2
    )

    created = user_conn |> gq_mutation(S.Article.m(:create_article, :post), variables)

    assert created |> Map.has_key?("innerId")
  end
end
