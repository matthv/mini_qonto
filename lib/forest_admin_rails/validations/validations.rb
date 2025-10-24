# frozen_string_literal: true

require_relative "field_validations"

module ForestAdminRails
  module Validations
    module_function

    def register(agent)
      FieldValidations.register(agent)
    end

    Validations = self
  end
end
