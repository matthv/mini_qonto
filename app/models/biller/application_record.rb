module Biller
  class ApplicationRecord < ActiveRecord::Base
    self.abstract_class = true

    connects_to database: {writing: :biller, reading: :biller}

    def self.polymorphic_class_for(name)
      "Biller::#{ActiveSupport::Inflector.classify(name)}".constantize
    end

    def self.polymorphic_name
      base_class.name.demodulize
    end
  end
end