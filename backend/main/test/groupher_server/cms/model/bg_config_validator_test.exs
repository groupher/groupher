defmodule GroupherServer.Test.CMS.Model.BgConfigValidatorTest do
  use ExUnit.Case, async: true

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.BgConfigValidator

  test "validates effect ranges in order" do
    for {field, value, message} <- [
          {"blurIntensity", 101, "has unsupported blur intensity"},
          {"brightness", 141, "has unsupported brightness"},
          {"saturation", 161, "has unsupported saturation"}
        ] do
      changeset =
        {%{},
         %{
           type: :string,
           pattern: :map,
           content_shadow: :map,
           effect: :map,
           texture: :map,
           gradient: :map
         }}
        |> cast(
          %{
            effect:
              Map.put(
                %{"blurIntensity" => 0, "brightness" => 100, "saturation" => 100},
                field,
                value
              )
          },
          [:effect]
        )
        |> BgConfigValidator.validate()

      assert {^message, []} = Keyword.fetch!(changeset.errors, :effect)
    end
  end

  test "validates texture shape and optional params" do
    invalid = %{"enabled" => true, "type" => "noise", "intensity" => 20, "params" => []}

    changeset =
      {%{},
       %{
         type: :string,
         pattern: :map,
         content_shadow: :map,
         effect: :map,
         texture: :map,
         gradient: :map
       }}
      |> cast(%{texture: invalid}, [:texture])
      |> BgConfigValidator.validate()

    assert {"has unsupported params", []} = Keyword.fetch!(changeset.errors, :texture)
  end
end
