rm -rf .git/modules/

# download all the submodules

<!-- git submodule update --init --recursive -->

./update_submodules.sh

# init the backend application:

docker compose -f docker-compose-local.yml up --build

# create a user for the api:

docker exec -ti trueodysseys-api bash

# DB migrate and upgrade:

docker exec -ti trueodysseys-api bash
flask db migrate
flask db upgrade

# this command will create an account with the name "name", email "email@email.com" and password "password"

flask permissions_commands create_user name email@email.com password

# if we want to sync the locations

docker exec -ti trueodysseys-api bash

flask commands update_municipalities

to test build:

1. npm run build
2. download latest prebuild release for windows: https://github.com/electron/electron/releases (electron-v30.0.1-win32-x64.zip)
3. all the folders and files in the client folder put them in "resources/app/" found in electron-v30.0.1-win32-x64 folder
4. click electron.exe

# access database:

docker exec -ti trueodysseys-db psql
\c trueodysseys

show tables: \dt

# Permissions submodule fix

cd flask/app/api/permissions

git add .



git commit -m "Commit message for submodule changes"

cd ../../../..

git add flask/app/api/permissions

pytest app/api/invoices/tests/test_invoice_routes.py::test_create_invoice


# activities table relations : (to delete in order)
reservation_activities
activities_locations
activity_details
meeting_points
activity_option_recurrences
activity_schedule_prices
activity_schedules
reservation_activity_options
schedule_price_modifiers
schedule_prices
activity_options
voucher_activity_options
activity_highlights
voucher_schedules
voucher_activities
itineraries

# Plinko Incinerator

A Solana-based application for incinerating empty token accounts and optionally gambling the recovered SOL using a Plinko game.

## Development Setup

### Running with Docker (Recommended)

#### Development Mode

For development with hot-reloading:

```bash
# Build and start the development container
npm run docker:dev

# Or directly with docker-compose
docker-compose up plinko-dev
```

This will:
- Mount your source code directly into the container
- Provide hot reloading for both frontend and backend
- Install all dependencies automatically
- Run the application in development mode

#### Production Mode

To test the production build:

```bash
# Build and start the production container
npm run docker:prod

# Or directly with docker-compose
docker-compose up plinko-prod
```

### Running Locally (Without Docker)

To run the application directly on your local machine:

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Start development mode (both frontend and backend)
npm run dev:all

# Or start them separately
npm run dev          # Frontend only
npm run server       # Backend only
```

## Building for Production

```bash
# Build both frontend and backend
npm run build:all

# Start the production build
npm run start:all
```

## Troubleshooting

If you encounter any issues with the development environment:

1. Make sure docker and docker-compose are installed and up to date
2. Rebuild the container with:
   ```bash
   docker-compose build --no-cache plinko-dev
   ```
3. If you're still having issues, try running the application locally without Docker
4. Check the logs for any specific error messages
