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
    mutation($community: String!, $themePreset: DsbThemePreset!, $themePresetBase: DsbThemePreset!, $themeOverwrite: Json) {
      saveCustomThemePreset(community: $community, themePreset: $themePreset, themePresetBase: $themePresetBase, themeOverwrite: $themeOverwrite) {
        id
        dashboard {
          layout {
            themePreset
            themePresetBase
            themeTokens
            themePresets {
              value
              tokens
            }
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
        themeOverwrite:
          Jason.encode!(%{
            "primaryColor" => "#112233",
            "accentColor" => "YELLOW",
            "gaussBlur" => 80.5,
            "glowType" => "PINK",
            "glowOpacity" => 30.5,
            "textTitle" => "#112233",
            "textDigestDark" => "#aabbcc"
          })
      }

      updated = rule_conn |> gq_mutation(@save_custom_theme_preset_query, variables)

      assert get_in(updated, ["dashboard", "layout", "themePreset"]) == "CUSTOM"
      assert get_in(updated, ["dashboard", "layout", "themePresetBase"]) == "CLAUDE"

      custom_option =
        updated
        |> get_in(["dashboard", "layout", "themePresets"])
        |> Enum.find(&(&1["value"] == "CUSTOM"))

      assert custom_option["tokens"]["accentColor"] == "YELLOW"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "accentColor"]) ==
               "YELLOW"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "gaussBlur"]) == 80.5
      assert custom_option["tokens"]["gaussBlur"] == 80.5
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "pageBgHue"]) == 48
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "pageBgHueDark"]) == 318
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "pageBgIntensity"]) == 32

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "pageBgIntensityDark"]) ==
               0

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowType"]) == "PINK"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowTypeDark"]) ==
               ""

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowFixed"]) == true
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowOpacity"]) == 30.5
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "glowOpacityDark"]) == 100
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitleDark"]) == "#f4eee7"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textDigestDark"]) ==
               "#aabbcc"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "cardColor"]) == "#fffdf8"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "cardColorDark"]) == "#261b22"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "dividerColor"]) == "#e6ded2"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "dividerColorDark"]) ==
               "#3a3035"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.theme_preset == :custom
      assert found.dashboard.layout.custom_theme_preset["basePreset"] == "claude"

      assert found.dashboard.layout.custom_theme_preset["overwrite"] == %{
               "primaryColor" => "#112233",
               "accentColor" => "YELLOW",
               "gaussBlur" => 80.5,
               "glowType" => "PINK",
               "glowOpacity" => 30.5,
               "textTitle" => "#112233",
               "textDigestDark" => "#aabbcc"
             }
    end

    test "save custom theme preset requires community update permission",
         ~m(user_conn guest_conn community)a do
      variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeOverwrite: Jason.encode!(%{"gaussBlur" => 70})
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
        themeOverwrite: Jason.encode!(%{"gaussBlur" => 70})
      }

      assert mutation_error?(rule_conn, @save_custom_theme_preset_query, variables)
    end

    test "save custom theme preset rejects custom as fork base", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CUSTOM",
        themeOverwrite: Jason.encode!(%{"gaussBlur" => 70})
      }

      assert mutation_error?(rule_conn, @save_custom_theme_preset_query, variables)
    end

    test "save custom theme preset merges sparse overwrite into existing custom",
         ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      first_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeOverwrite: Jason.encode!(%{"primaryColor" => "#112233"})
      }

      second_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeOverwrite: Jason.encode!(%{"textTitle" => "#445566"})
      }

      rule_conn |> gq_mutation(@save_custom_theme_preset_query, first_variables)
      updated = rule_conn |> gq_mutation(@save_custom_theme_preset_query, second_variables)

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "primaryColor"]) == "#112233"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitle"]) == "#445566"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.custom_theme_preset["overwrite"] == %{
               "primaryColor" => "#112233",
               "textTitle" => "#445566"
             }
    end

    test "save custom theme preset prunes overwrite values equal to base preset",
         ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeOverwrite:
          Jason.encode!(%{
            "cardColor" => "#fffdf8",
            "textTitle" => "#445566"
          })
      }

      updated = rule_conn |> gq_mutation(@save_custom_theme_preset_query, variables)

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "cardColor"]) == "#fffdf8"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitle"]) == "#445566"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.custom_theme_preset["overwrite"] == %{
               "textTitle" => "#445566"
             }
    end

    test "save custom theme preset rejects unknown overwrite keys and wrong value types",
         ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      unknown_key_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeOverwrite: Jason.encode!(%{"unknownToken" => "#fff"})
      }

      wrong_type_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeOverwrite: Jason.encode!(%{"gaussBlur" => "70"})
      }

      assert mutation_error?(rule_conn, @save_custom_theme_preset_query, unknown_key_variables)
      assert mutation_error?(rule_conn, @save_custom_theme_preset_query, wrong_type_variables)
    end

    test "save custom theme preset resets custom base with empty overwrite", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      custom_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeOverwrite: Jason.encode!(%{"primaryColor" => "#112233"})
      }

      reset_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "HN",
        themeOverwrite: Jason.encode!(%{})
      }

      rule_conn |> gq_mutation(@save_custom_theme_preset_query, custom_variables)
      updated = rule_conn |> gq_mutation(@save_custom_theme_preset_query, reset_variables)

      assert get_in(updated, ["dashboard", "layout", "themePreset"]) == "CUSTOM"
      assert get_in(updated, ["dashboard", "layout", "themePresetBase"]) == "HN"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "primaryColor"]) == "#333333"

      custom_option =
        updated
        |> get_in(["dashboard", "layout", "themePresets"])
        |> Enum.find(&(&1["value"] == "CUSTOM"))

      assert custom_option["tokens"]["primaryColor"] == "#333333"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.custom_theme_preset["overwrite"] == %{}
    end

    test "save custom theme preset clears overwrite when reset keeps the same base",
         ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      custom_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeOverwrite: Jason.encode!(%{"primaryColor" => "#112233"})
      }

      reset_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeOverwrite: Jason.encode!(%{})
      }

      rule_conn |> gq_mutation(@save_custom_theme_preset_query, custom_variables)
      updated = rule_conn |> gq_mutation(@save_custom_theme_preset_query, reset_variables)

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "primaryColor"]) == "#c96442"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.custom_theme_preset["overwrite"] == %{}
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
            themePresets {
              value
              tokens
            }
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

      refute Enum.any?(
               get_in(updated, ["dashboard", "layout", "themePresets"]),
               &(&1["value"] == "CUSTOM")
             )

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitle"]) == "#222222"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitleDark"]) == "#e6e6e6"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "cardColor"]) == "#fffff5"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "cardColorDark"]) == "#292625"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "dividerColor"]) == "#e6e6d6"

      assert get_in(updated, ["dashboard", "layout", "themeTokens", "dividerColorDark"]) ==
               "#3c3938"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.theme_preset == :hn
      assert found.dashboard.layout.custom_theme_preset == nil
    end

    test "select theme preset preserves saved custom preset overwrite", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      custom_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeOverwrite:
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
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitle"]) == "#222222"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "textTitleDark"]) == "#e6e6e6"

      custom_option =
        updated
        |> get_in(["dashboard", "layout", "themePresets"])
        |> Enum.find(&(&1["value"] == "CUSTOM"))

      assert custom_option["tokens"]["primaryColor"] == "#112233"
      assert custom_option["tokens"]["textTitle"] == "#112233"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.theme_preset == :hn
      assert found.dashboard.layout.custom_theme_preset["basePreset"] == "claude"
      assert found.dashboard.layout.custom_theme_preset["overwrite"]["primaryColor"] == "#112233"
    end

    test "select custom preset after readonly selection reuses saved overwrite", ~m(community)a do
      rule_conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

      custom_variables = %{
        community: community.slug,
        themePreset: "CUSTOM",
        themePresetBase: "CLAUDE",
        themeOverwrite: Jason.encode!(%{"primaryColor" => "#112233"})
      }

      rule_conn |> gq_mutation(@save_custom_theme_preset_query, custom_variables)

      rule_conn
      |> gq_mutation(@select_theme_preset_query, %{community: community.slug, themePreset: "HN"})

      updated =
        rule_conn
        |> gq_mutation(@save_custom_theme_preset_query, %{
          community: community.slug,
          themePreset: "CUSTOM",
          themePresetBase: "CLAUDE",
          themeOverwrite: Jason.encode!(%{})
        })

      assert get_in(updated, ["dashboard", "layout", "themePreset"]) == "CUSTOM"
      assert get_in(updated, ["dashboard", "layout", "themeTokens", "primaryColor"]) == "#112233"

      {:ok, found} = Community |> ORM.find(updated["id"], preload: :dashboard)

      assert found.dashboard.layout.custom_theme_preset["overwrite"] == %{
               "primaryColor" => "#112233"
             }
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
