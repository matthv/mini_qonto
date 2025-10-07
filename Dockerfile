# Use official Ruby image
FROM ruby:3.3.6-slim

# Install dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    nodejs \
    postgresql-client \
    git && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Gemfile and Gemfile.lock
COPY Gemfile Gemfile.lock ./

# NOTE: The Gemfile references local gems with 'path:' directives
# You'll need to either:
# 1. Copy the local gem directories into the Docker context
# 2. Modify Gemfile to use published versions
# 3. Use a multi-stage build with the gems pre-built
#
# For development, you can mount the local gems as volumes

# Install gems
RUN bundle config set --local without 'development test' && \
    bundle install

# Copy application code
COPY . .

# Precompile assets (optional, for production)
# RUN bundle exec rails assets:precompile

# Expose port
EXPOSE 3000

# Start the server
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
