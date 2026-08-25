defmodule GroupherServer.Test.Helper.SlugValidator do
  @moduledoc false

  use ExUnit.Case, async: true

  alias Helper.Validator.Slug

  describe "valid?/1" do
    test "accepts SEO-friendly URL slugs" do
      assert Slug.valid?("react")
      assert Slug.valid?("react-19")
      assert Slug.valid?("react-19-guide")
    end

    test "rejects non SEO-friendly URL slugs" do
      refute Slug.valid?("React")
      refute Slug.valid?("react_19")
      refute Slug.valid?("react--19")
      refute Slug.valid?("-react")
      refute Slug.valid?("react-")
      refute Slug.valid?("react/19")
      refute Slug.valid?("react?tab=19")
      refute Slug.valid?("react#19")
      refute Slug.valid?("中文")
      refute Slug.valid?("")
      refute Slug.valid?(nil)
    end
  end

  describe "normalize/1" do
    test "normalizes arbitrary generated text into SEO-friendly URL slugs" do
      assert Slug.normalize(" React 19 中文 ") == "react-19"
      assert Slug.normalize("react___19") == "react-19"
      assert Slug.normalize("react///19??guide") == "react-19-guide"
      assert Slug.normalize("__react__") == "react"
    end
  end
end
