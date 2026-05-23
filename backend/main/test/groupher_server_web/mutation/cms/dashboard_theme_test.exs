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
    mutation($community: String!, $themePreset: DsbThemePreset!, $themePresetBase: DsbThemePreset!, $themeTokens: Json) {
      saveCustomThemePreset(community: $community, themePreset: $themePreset, themePresetBase: $themePresetBase, themeTokens: $themeTokens) {
        id
        dashboard {
          layout {
            themePreset
            themePresetBase
            themeTokens
            hasCustomThemePreset
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
            "pageBgHue" => 42,
            "pageBgHueDark" => 318,
            "pageBgIntensity" => 52,
            "pageBgIntensityDark" => 61,
            "gaussBlur" => 80.5,
            "gaussBlurDark" => 60.5,
            "glowType" => "PINK",
            "glowTypeDark" => "GREY_GREEN",
            "glowFixed" => true,
            "glowOpacity" => 30.5,
            "glowOpacityDark" => 45.5,
            "textTitle" => "#112233",
            "textTitleDark" => "#ddeeff",
            "textDigest" => "#667788",
            "textDigestDark" => "#aabbcc",
            "cardColor" => "#fffdf8",
            "cardColorDark" => "#261b22",
            "dividerColor" => "#e6ded2",
            "dividerColorDark" => "#3a3035"
          })
      }

      updated = rule_conn |> gq_mutation(@save_custom_theme_preset_query, variables)

      assert get_in(updated, ["dashboard", "layout", "themePreset"]) == "CUSTOM"
      assert get_in(updated, ["dashboard", "layout", "themePresetBase"]) == "CLAUDE"
      assert get_in(updated, ["dashboard", "layout", "hasCustomThemePreset"]) == true

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "accentColor"]) ==
               "YELLOW"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "gaussBlur"]) == 80.5
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "pageBgHue"]) == 42
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "pageBgHueDark"]) == 318
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "pageBgIntensity"]) == 52

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "pageBgIntensityDark"]) ==
               61

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowType"]) == "PINK"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowTypeDark"]) ==
               "GREY_GREEN"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowFixed"]) == true
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowOpacity"]) == 30.5
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowOpacityDark"]) == 45.5
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitleDark"]) == "#ddeeff"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textDigestDark"]) ==
               "#aabbcc"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "cardColor"]) == "#fffdf8"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "cardColorDark"]) == "#261b22"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "dividerColor"]) == "#e6ded2"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "dividerColorDark"]) ==
               "#3a3035"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.theme_preset == :custom
      assert found.dashboard.layout.theme_preset_base == :claude
      assert found.dashboard.layout.theme_overwrite["primaryColor"] == "#112233"
      assert found.dashboard.layout.theme_overwrite["pageBgHue"] == 42
      assert found.dashboard.layout.theme_overwrite["pageBgHueDark"] == 318
      assert found.dashboard.layout.theme_overwrite["pageBgIntensity"] == 52
      assert found.dashboard.layout.theme_overwrite["pageBgIntensityDark"] == 61
      assert found.dashboard.layout.theme_overwrite["glowType"] == "PINK"
      assert found.dashboard.layout.theme_overwrite["glowTypeDark"] == "GREY_GREEN"
      assert found.dashboard.layout.theme_overwrite["glowFixed"] == true
      assert found.dashboard.layout.theme_overwrite["glowOpacity"] == 30.5
      assert found.dashboard.layout.theme_overwrite["glowOpacityDark"] == 45.5
      assert found.dashboard.layout.theme_overwrite["cardColor"] == "#fffdf8"
      assert found.dashboard.layout.theme_overwrite["cardColorDark"] == "#261b22"
      assert found.dashboard.layout.theme_overwrite["dividerColor"] == "#e6ded2"
      assert found.dashboard.layout.theme_overwrite["dividerColorDark"] == "#3a3035"
      assert found.dashboard.layout.theme_overwrite["gaussBlur"] == 80.5
      assert found.dashboard.layout.theme_overwrite["gaussBlurDark"] == 60.5
      assert found.dashboard.layout.theme_overwrite["textTitle"] == "#112233"
      assert found.dashboard.layout.theme_overwrite["textTitleDark"] == "#ddeeff"
      assert found.dashboard.layout.theme_overwrite["textDigest"] == "#667788"
      assert found.dashboard.layout.theme_overwrite["textDigestDark"] == "#aabbcc"
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
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitleDark"]) == "#e6e6e6"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "cardColor"]) == "#fffff5"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "cardColorDark"]) == "#292625"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "dividerColor"]) == "#e6e6d6"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "dividerColorDark"]) ==
               "#3c3938"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.theme_preset == :hn
      assert found.dashboard.layout.theme_preset_base == :default
      assert found.dashboard.layout.theme_overwrite == %{}
    end

    test "select theme preset preserves saved custom preset overwrite", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      custom_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeTokens:
          Jason.encode!(%{
            "primaryColor" => "#112233",
            "gaussBlur" => 80.5,
            "textTitle" => "#112233",
            "textTitleDark" => "#ddeeff",
            "textDigest" => "#667788",
            "textDigestDark" => "#aabbcc"
          })
      }

      rule_conn |> gq_mutation(@save_custom_theme_preset_query, custom_variables)

      updated =
        rule_conn
        |> gq_mutation(@select_theme_preset_query, %{community: community.slug, themePreset: "HN"})

      assert get_in(updated, ["dashboard", "layout", "themePreset"]) == "HN"
      assert get_in(updated, ["dashboard", "layout", "themePresetBase"]) == "CLAUDE"
      assert get_in(updated, ["dashboard", "layout", "hasCustomThemePreset"]) == true
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitle"]) == "#222222"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitleDark"]) == "#e6e6e6"

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
