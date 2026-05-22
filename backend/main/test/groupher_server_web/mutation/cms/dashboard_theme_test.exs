defmodule GroupherServer.Test.Mutation.CMS.DashboardTheme do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    community_attrs = mock_attrs(:community)
    {:ok, community} = CMS.Communities.create(community_attrs, user)

    user_conn = simu_conn(:user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn community)a}
  end

  describe "[mutation cms dashboard theme]" do
    @save_custom_theme_preset_query """
    mutation($community: String!, $themePreset: DsbThemePreset!, $themePresetBase: DsbThemePreset!, $themeTokens: Json, $textTitle: String, $textDigest: String, $gaussBlur: Float, $gaussBlurDark: Float) {
      saveCustomThemePreset(community: $community, themePreset: $themePreset, themePresetBase: $themePresetBase, themeTokens: $themeTokens, textTitle: $textTitle, textDigest: $textDigest, gaussBlur: $gaussBlur, gaussBlurDark: $gaussBlurDark) {
        id
        dashboard {
          layout {
            themePreset
            themePresetBase
            themeTokens
            hasCustomThemePreset
            textTitle
            textDigest
            gaussBlur
            gaussBlurDark
          }
        }
      }
    }
    """
    test "save custom theme preset stores fork base and overwrite", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeTokens:
          Jason.encode!(%{
            "primaryColor" => "#112233",
            "accentColor" => "YELLOW",
            "gaussBlur" => 80.5,
            "glowType" => "PINK",
            "glowTypeDark" => "GREY_GREEN",
            "glowFixed" => true,
            "glowOpacity" => 30.5,
            "glowOpacityDark" => 45.5
          }),
        textTitle: "#112233",
        textDigest: "#667788",
        gaussBlur: 80.5,
        gaussBlurDark: 60.5
      }

      updated = rule_conn |> gq_mutation(@save_custom_theme_preset_query, variables)

      assert get_in(updated, ["dashboard", "layout", "themePreset"]) == "CUSTOM"
      assert get_in(updated, ["dashboard", "layout", "themePresetBase"]) == "CLAUDE"
      assert get_in(updated, ["dashboard", "layout", "hasCustomThemePreset"]) == true

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "accentColor"]) ==
               "YELLOW"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "gaussBlur"]) == 80.5
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowType"]) == "PINK"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowTypeDark"]) ==
               "GREY_GREEN"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowFixed"]) == true
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowOpacity"]) == 30.5
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowOpacityDark"]) == 45.5

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.theme_preset == :custom
      assert found.dashboard.layout.theme_preset_base == :claude
      assert found.dashboard.layout.theme_overwrite["primaryColor"] == "#112233"
      assert found.dashboard.layout.theme_overwrite["glowType"] == "PINK"
      assert found.dashboard.layout.theme_overwrite["glowTypeDark"] == "GREY_GREEN"
      assert found.dashboard.layout.theme_overwrite["glowFixed"] == true
      assert found.dashboard.layout.theme_overwrite["glowOpacity"] == 30.5
      assert found.dashboard.layout.theme_overwrite["glowOpacityDark"] == 45.5
      assert found.dashboard.layout.gauss_blur == 80.5
      assert found.dashboard.layout.gauss_blur_dark == 60.5
      assert found.dashboard.layout.text_title == "#112233"
      assert found.dashboard.layout.text_digest == "#667788"
    end

    test "save custom theme preset requires community update permission",
         ~m(user_conn guest_conn community)a do
      variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeTokens: Jason.encode!(%{"gaussBlur" => 70})
      }

      rule_conn = simu_conn(:user, cms: %{community.slug => %{"what.ever" => true}})

      assert user_conn
             |> mutation_error?(@save_custom_theme_preset_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(
               @save_custom_theme_preset_query,
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(@save_custom_theme_preset_query, variables, ecode(:passport))
    end

    test "save custom theme preset rejects non-custom preset saves", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        themePreset: "CLAUDE",
        themePresetBase: "CLAUDE",
        themeTokens: Jason.encode!(%{"gaussBlur" => 70})
      }

      assert mutation_error?(rule_conn, @save_custom_theme_preset_query, variables)
    end

    test "save custom theme preset rejects custom as fork base", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CUSTOM",
        themeTokens: Jason.encode!(%{"gaussBlur" => 70})
      }

      assert mutation_error?(rule_conn, @save_custom_theme_preset_query, variables)
    end

    @select_theme_preset_query """
    mutation($community: String!, $themePreset: DsbThemePreset!) {
      selectThemePreset(community: $community, themePreset: $themePreset) {
        id
        dashboard {
          layout {
            themePreset
            themePresetBase
            themeTokens
            hasCustomThemePreset
            textTitle
            textDigest
            gaussBlur
            gaussBlurDark
          }
        }
      }
    }
    """
    test "select theme preset stores a read-only preset without custom overwrite",
         ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      updated =
        rule_conn
        |> gq_mutation(@select_theme_preset_query, %{community: community.slug, themePreset: "HN"})

      assert get_in(updated, ["dashboard", "layout", "themePreset"]) == "HN"
      assert get_in(updated, ["dashboard", "layout", "themePresetBase"]) == "DEFAULT"
      assert get_in(updated, ["dashboard", "layout", "hasCustomThemePreset"]) == false
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitle"]) == "#222222"
      assert get_in(updated, ["dashboard", "layout", "textTitle"]) == "#222222"
      assert get_in(updated, ["dashboard", "layout", "textDigest"]) == "#666666"
      assert get_in(updated, ["dashboard", "layout", "gaussBlur"]) == 100
      assert get_in(updated, ["dashboard", "layout", "gaussBlurDark"]) == 100

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.theme_preset == :hn
      assert found.dashboard.layout.theme_preset_base == :default
      assert found.dashboard.layout.theme_overwrite == %{}
      assert found.dashboard.layout.text_title == "#222222"
      assert found.dashboard.layout.text_digest == "#666666"
      assert found.dashboard.layout.gauss_blur == 100
      assert found.dashboard.layout.gauss_blur_dark == 100
    end

    test "select theme preset preserves saved custom preset overwrite", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      custom_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeTokens: Jason.encode!(%{"primaryColor" => "#112233", "gaussBlur" => 80.5}),
        textTitle: "#112233",
        textDigest: "#667788",
        gaussBlur: 80.5,
        gaussBlurDark: 60.5
      }

      rule_conn |> gq_mutation(@save_custom_theme_preset_query, custom_variables)

      updated =
        rule_conn
        |> gq_mutation(@select_theme_preset_query, %{community: community.slug, themePreset: "HN"})

      assert get_in(updated, ["dashboard", "layout", "themePreset"]) == "HN"
      assert get_in(updated, ["dashboard", "layout", "themePresetBase"]) == "CLAUDE"
      assert get_in(updated, ["dashboard", "layout", "hasCustomThemePreset"]) == true
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitle"]) == "#222222"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.theme_preset == :hn
      assert found.dashboard.layout.theme_preset_base == :claude
      assert found.dashboard.layout.theme_overwrite["primaryColor"] == "#112233"
    end

    test "select theme preset requires community update permission",
         ~m(user_conn guest_conn community)a do
      variables = %{community: community.slug, themePreset: "HN"}
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"what.ever" => true}})

      assert user_conn
             |> mutation_error?(@select_theme_preset_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(@select_theme_preset_query, variables, ecode(:account_login))

      assert rule_conn
             |> mutation_error?(@select_theme_preset_query, variables, ecode(:passport))
    end
  end
end
