defmodule GroupherServer.Test.CMS.Helper.EmotionFormatterTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Helper.EmotionFormatter

  describe "format/2" do
    test "formats atom-key emotion maps" do
      assert [
               %{
                 type: :beer,
                 count: 2,
                 viewer_has_reacted: true,
                 latest_users: [%{login: "alice"}]
               }
             ] =
               EmotionFormatter.format(
                 %{
                   beer_count: 2,
                   latest_beer_users: [%{login: "alice"}],
                   viewer_has_beered: true
                 },
                 :article
               )
    end

    test "does not read string-key emotion maps" do
      assert [] =
               EmotionFormatter.format(
                 %{
                   "beer_count" => 2,
                   "latest_beer_users" => [%{"login" => "alice"}],
                   "viewer_has_beered" => true
                 },
                 :article
               )
    end
  end
end
