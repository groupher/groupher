defmodule GroupherServer.Test.CMS.MarkerTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Marker

  describe "normalize/1" do
    test "normalizes icon appearance for both themes" do
      marker = %{
        type: :icon,
        provider: "lucide",
        name: "external-link",
        src: "/icons/lucide/external-link.svg",
        appearance: %{
          light: %{color: "#112233", bg: "#AABBCCDD"},
          dark: %{color: "#ffffff", bg: "#222222"}
        }
      }

      assert {:ok, normalized} = Marker.normalize(marker)

      assert normalized.appearance == %{
               light: %{color: "#112233", bg: "#aabbccdd"},
               dark: %{color: "#ffffff", bg: "#222222"}
             }
    end

    test "drops foreground color from emoji appearance" do
      marker = %{
        "type" => "EMOJI",
        "unified" => "1f44d",
        "appearance" => %{
          "light" => %{"color" => "#112233", "bg" => "#eeeeee"},
          "dark" => %{"color" => "#ffffff", "bg" => "#222222"}
        }
      }

      assert {:ok, normalized} = Marker.normalize(marker)

      assert normalized.appearance == %{
               light: %{bg: "#eeeeee"},
               dark: %{bg: "#222222"}
             }
    end

    test "requires both theme keys when appearance is present" do
      marker = %{
        type: :emoji,
        unified: "1f44d",
        appearance: %{light: %{bg: "#eeeeee"}}
      }

      assert {:error, "marker appearance dark is required"} = Marker.normalize(marker)
    end

    test "rejects invalid appearance colors" do
      marker = %{
        type: :emoji,
        unified: "1f44d",
        appearance: %{light: %{bg: "red"}, dark: %{}}
      }

      assert {:error, "marker appearance bg is invalid"} = Marker.normalize(marker)
    end
  end
end
