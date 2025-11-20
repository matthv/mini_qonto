Rails.application.routes.draw do
  mount ForestAdminRails::Engine => "#{ForestAdminRails.config[:prefix]}"
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Defines the root path route ("/")
  # root "articles#index"
end
