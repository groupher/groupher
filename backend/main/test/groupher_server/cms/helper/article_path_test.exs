defmodule GroupherServer.Test.CMS.Helper.ArticlePathTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Helper.ArticlePath

  describe "parse/2" do
    test "parses a canonical atom-key article path" do
      assert ArticlePath.parse(%{community: "home", thread: :post, inner_id: "12"}) ==
               {:ok, %{community: "home", thread: :post, inner_id: "12"}}
    end

    test "validates a fixed thread when present" do
      assert ArticlePath.parse(%{community: "home", thread: :post, inner_id: "12"},
               thread: :post
             ) == {:ok, %{community: "home", thread: :post, inner_id: "12"}}
    end

    test "rejects raw string maps and string threads" do
      assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_article_path}} =
               ArticlePath.parse(%{
                 "community" => "home",
                 "thread" => "POST",
                 "innerId" => "12"
               })

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_article_path}} =
               ArticlePath.parse(%{community: "home", thread: "post", inner_id: "12"})
    end

    test "rejects a fixed thread mismatch" do
      assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_article_path}} =
               ArticlePath.parse(%{community: "home", thread: :blog, inner_id: "12"},
                 thread: :post
               )
    end

    test "rejects missing required fields" do
      assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_article_path}} =
               ArticlePath.parse(%{thread: :post, inner_id: "12"})

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_article_path}} =
               ArticlePath.parse(%{community: "home", thread: :post})

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_article_path}} =
               ArticlePath.parse(%{community: "home", inner_id: "12"})

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_article_path}} =
               ArticlePath.parse(%{community: nil, thread: :post, inner_id: "12"})

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_article_path}} =
               ArticlePath.parse(%{community: %{slug: "home"}, thread: :post, inner_id: "12"})
    end
  end

  describe "parse_arguments/2" do
    test "stores parsed article path without removing original arguments" do
      arguments = %{
        article: %{community: "home", thread: :post, inner_id: "12"},
        body: "hello"
      }

      assert {:ok, parsed} = ArticlePath.parse_arguments(arguments)
      assert parsed.article == arguments.article
      assert parsed.body == "hello"
      assert parsed.article_path == %{community: "home", thread: :post, inner_id: "12"}
    end

    test "prefers an existing article_path over raw article input" do
      arguments = %{
        article: %{community: "raw", thread: :blog, inner_id: "1"},
        article_path: %{community: "home", thread: :post, inner_id: "12"}
      }

      assert {:ok, parsed} = ArticlePath.parse_arguments(arguments)
      assert parsed.article == arguments.article
      assert parsed.article_path == %{community: "home", thread: :post, inner_id: "12"}
    end

    test "validates fixed thread against the embedded path" do
      assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_article_path}} =
               ArticlePath.parse_arguments(
                 %{article_path: %{community: "home", thread: :blog, inner_id: "12"}},
                 thread: :post
               )
    end
  end
end
