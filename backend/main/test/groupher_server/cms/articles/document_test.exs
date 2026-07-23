defmodule GroupherServer.Test.CMS.Articles.Document do
  @moduledoc false

  use GroupherServer.TestMate

  @plate_body Jason.encode!([
                %{"type" => "p", "children" => [%{"text" => "hello article body"}]}
              ])

  describe "[article document]" do
    setup do
      {_, doc, _, _} = mock_article(:doc)

      {:ok, ~m(doc)a}
    end

    test "returns custom error shape when document already exists", ~m(doc)a do
      assert {:error, {:custom, "document already exists"}} =
               CMS.Articles.Document.create(doc, %{body_bag: mock_body_bag(@plate_body)})

      assert {:error, {:custom, "document already exists"}} =
               CMS.Articles.Document.create_doc(doc, %{body_bag: mock_body_bag(@plate_body)})
    end

    test "returns invalid article errors" do
      assert {:error, {:custom, "invalid article"}} =
               CMS.Articles.Document.create(%{}, %{body_bag: mock_body_bag(@plate_body)})
    end
  end
end
