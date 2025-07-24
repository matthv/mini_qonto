module Other
  class ApplicationRecord < ActiveRecord::Base
    self.abstract_class = true

    connects_to database: {writing: :other, reading: :other}

    # Forest v9 has an issue when handling polymorphic associations where it misses the namespace
    # due to how it is stored in the database in the original service
    # versus how backoffice refers to it (i.e. "Membership" instead of "Api::Membership").
    # This solution is based on https://shopify.engineering/changing-polymorphic-type-rails
    def self.polymorphic_class_for(name)
      "Api::#{ActiveSupport::Inflector.classify(name)}".constantize
    end

    def self.polymorphic_name
      base_class.name.demodulize
    end
  end
end