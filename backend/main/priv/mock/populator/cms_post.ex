# for mock CMS posts

defmodule GroupherServer.Mock.CMS.Post do
  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.Post

  def random_attrs do
    %{
      title: Faker.Person.first_name() <> " " <> Faker.Person.last_name(),
      body: Faker.Lorem.sentence(20)
    }
  end

  def random(count \\ 1) do
    for _u <- 1..count do
      insert_multi()
    end
  end

  # def insert(user) do
  # User.changeset(%User{}, user)
  # |> Repo.insert!
  # end

  defp insert_multi do
    Post.changeset(%Post{}, random_attrs())
    |> Repo.insert!()
  end
end
