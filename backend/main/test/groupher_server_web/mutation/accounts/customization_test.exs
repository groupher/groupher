defmodule GroupherServer.Test.Mutation.Account.Customization do
  @moduledoc false

  use GroupherServer.TestTools

  @max_page_size get_config(:general, :page_size)

  setup do
    {:ok, user} = db_insert(:user)

    user_conn = simu_conn(:user, user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn user)a}
  end

  describe "[account customization mutation]" do
    @query """
    mutation(
      $userId: ID,
      $customization: CustomizationInput!,
      $sidebarCommunitiesIndex: [CommunityIndex]
      ) {
    setCustomization(
      userId: $userId,
      customization: $customization,
      sidebarCommunitiesIndex: $sidebarCommunitiesIndex
      ) {
        id
        customization {
          bannerLayout
          contentDivider
          contentHover
          markViewed
          displayDensity
        }
      }
    }
    """
    test "user can set customization", ~m(user_conn)a do
      # owned_conn = simu_conn(:user, user)
      variables = %{
        customization: %{
          bannerLayout: "BRIEF",
          contentDivider: true,
          contentHover: false,
          markViewed: false,
          displayDensity: "25"
        },
        sidebarCommunitiesIndex: [%{community: "javascript", index: 1}]
      }

      result = user_conn |> gq_mutation(@query, variables)

      assert result["customization"]["bannerLayout"] == "brief"
      assert result["customization"]["contentDivider"] == true
      assert result["customization"]["contentHover"] == false
      assert result["customization"]["markViewed"] == false
      assert result["customization"]["displayDensity"] == "25"
    end

    @tag :wip
    test "PageSizeProof middleware should lint c11n displayDensity size", ~m(user)a do
      user_conn = simu_conn(:user, user)
      db_insert_multi(:post, 50)

      variables = %{
        customization: %{
          displayDensity: "40"
        }
      }

      user_conn |> gq_mutation(@query, variables)

      variables = %{filter: %{page: 1}}
      results = user_conn |> gq_query(Schema.q(:paged_articles, :post), variables)
      assert results["pageSize"] == @max_page_size
    end

    test "set single customization should merge not overweight other settings", ~m(user_conn)a do
      variables = %{
        customization: %{
          bannerLayout: "BRIEF"
        }
      }

      result = user_conn |> gq_mutation(@query, variables)
      assert result["customization"]["bannerLayout"] == "brief"

      variables = %{
        customization: %{
          displayDensity: "25"
        }
      }

      result = user_conn |> gq_mutation(@query, variables)
      assert result["customization"]["bannerLayout"] == "brief"
      assert result["customization"]["displayDensity"] == "25"
    end

    test "user set customization with invalid attr fails", ~m(user_conn)a do
      variables1 = %{
        customization: %{
          bannerLayout: "OTHER"
        }
      }

      variables2 = %{
        customization: %{
          contentsLayout: "OTHER"
        }
      }

      assert user_conn |> mutation_error?(@query, variables1)
      assert user_conn |> mutation_error?(@query, variables2)
    end

    test "unlogin user set customization fails", ~m(guest_conn)a do
      variables = %{
        customization: %{
          bannerLayout: "DIGEST"
        }
      }

      assert guest_conn |> mutation_error?(@query, variables, ecode(:account_login))
    end
  end
end
