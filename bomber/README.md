# Bomber

A testing tool for Forest Admin agent integration testing.

## Setup

### 1. Environment Configuration

Create a `.env` file in the bomber directory with your Forest Admin project secrets:

```env
FOREST_ENV_SECRET=7aeabdf6874ebcb37dbf6c8ba6b7baad824d71e77dd8cca3749ae8b347e6af64
FOREST_AUTH_SECRET=secret
AGENT_PATH=../../.forestadmin-agent.json

# Optional: Customize ports if needed
AGENT_PORT=3000                    # Port where your agent is running (default: 3000)
SERVER_SANDBOX_PORT=3311           # Port for the mocked server (default: 3311)
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Initialize Sandbox Environment

```bash
yarn presandbox
yarn sandbox
```

### 4. Configure Your Agent

Update the `.env` file in your agent directory:

```env
# Required: Set the test database port
DB_PORT=5433

# Optional: Use the mocked Forest Admin server
FOREST_SERVER_URL=http://localhost:3311
```

### 5. Run Your Agent

Start your Forest Admin agent in a separate terminal.

### 6. Run Tests

Execute tests in another terminal:

```bash
# Run all tests
yarn test

# Run a specific test
yarn test -t "name-of-your-test"
```

## Architecture

This tool provides:
- A sandboxed test database (port 5433)
- An optional mocked Forest Admin server (port 3311)
- Integration test utilities for agent testing