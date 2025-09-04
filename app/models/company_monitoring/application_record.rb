module CompanyMonitoring
  class ApplicationRecord < ActiveRecord::Base
    self.abstract_class = true

    connects_to database: {writing: :company_monitoring, reading: :company_monitoring}

  end
end