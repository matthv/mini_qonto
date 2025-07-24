class Forest::Income
  include ForestLiana::Collection

  collection :Api__Income

  field :organization_name, type: String do
    object.organization.name
  end
end