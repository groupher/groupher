# Inside the script, you can read and write to any of your
# repositories directly:
#
#     GroupherServer.Repo.insert!(%GroupherServer.SomeSchema{})
#

defmodule GroupherServer.Mock.User do
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Repo

  def random_attrs do
    %{
      username: Faker.Person.first_name() <> " " <> Faker.Person.last_name(),
      nickname: Faker.Person.first_name() <> " " <> Faker.Person.last_name(),
      bio: Faker.Person.first_name(),
      company: Faker.Company.name()
    }
  end

  def random(count \\ 1) do
    for _u <- 1..count do
      insert_multi()
    end
  end

  def insert(user) do
    User.changeset(%User{}, user)
    |> Repo.insert!()
  end

  defp insert_multi do
    User.changeset(%User{}, random_attrs())
    |> Repo.insert!()
  end
end
