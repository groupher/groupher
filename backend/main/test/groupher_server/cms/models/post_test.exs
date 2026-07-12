defmodule GroupherServer.Test.CMS.Models.PostTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Model.Post

  @valid_attrs %{
    branch_id: 1,
    article_hash_id: "00000000-0000-0000-0000-000000000001",
    title: "valid title",
    digest: "valid digest"
  }

  describe "changeset/2 enum attrs" do
    test "accepts atom enum attrs" do
      changeset = Post.changeset(%Post{}, Map.merge(@valid_attrs, %{cat: :idea, status: :todo}))

      assert changeset.valid?
      assert Ecto.Changeset.get_change(changeset, :cat) == :idea
      assert Ecto.Changeset.get_change(changeset, :status) == :todo
    end

    test "rejects string enum values before Ecto.Enum casting" do
      changeset = Post.changeset(%Post{}, Map.merge(@valid_attrs, %{cat: "idea", status: "todo"}))

      refute changeset.valid?
      assert {"must be an enum atom", []} in Keyword.get_values(changeset.errors, :cat)
      assert {"must be an enum atom", []} in Keyword.get_values(changeset.errors, :status)
    end

    test "rejects string enum keys" do
      changeset =
        Post.changeset(%Post{}, %{
          "title" => "valid title",
          "digest" => "valid digest",
          "cat" => "idea",
          "status" => "todo"
        })

      refute changeset.valid?
      assert {"must be an enum atom", []} in Keyword.get_values(changeset.errors, :cat)
      assert {"must be an enum atom", []} in Keyword.get_values(changeset.errors, :status)
    end
  end
end
