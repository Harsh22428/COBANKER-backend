# CoBanker Backend Setup and Testing Guide

##  Overview

This guide will help you set up and test the CoBanker backend API with Supabase database integration.

##  Prerequisites

- Node.js 18+ installed
- Supabase account and project
- Postman (for API testing)

##  Setup Instructions

### 1. Environment Configuration

The backend is configured with the following environment variables in `.env`:

```env
NODE_ENV=development
PORT=3001
API_VERSION=v1

# Supabase Configuration
SUPABASE_URL=https://ajcoctcqipwiztubuyaw.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# JWT Configuration
JWT_SECRET=cobanker_super_secure_jwt_secret_key_2025_development_only
JWT_EXPIRES_IN=24h
```

### 2. Database Schema Setup

Run the following SQL commands in your Supabase SQL editor to create the required tables:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Banks table
CREATE TABLE IF NOT EXISTS banks (
    bank_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    address JSONB,
    contact_info JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    address JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Members table
CREATE TABLE IF NOT EXISTS members (
    member_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Simple todos table (for testing)
CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample data
INSERT INTO todos (title) VALUES 
('Setup database schema'),
('Test API endpoints'),
('Configure authentication')
ON CONFLICT DO NOTHING;
```

### 3. Install Dependencies

```bash
cd "backend 1/backend2/backend"
npm install
```

### 4. Test Database Connection

```bash
node test-connection.js
```

### 5. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Or start directly
node src/server.js

# Or use the simple test server
node simple-server.js
```

##  Testing with Postman

### Import the Collection

1. Open Postman
2. Click "Import"
3. Select the file: `CoBanker-Backend-API.postman_collection.json`
4. The collection will be imported with all endpoints

### Environment Variables

Set up these variables in Postman:

- `base_url`: `http://localhost:3001`
- `api_version`: `v1`
- `auth_token`: (will be set automatically after login)

### Test Endpoints

#### 1. Health Check
```
GET {{base_url}}/health
```

#### 2. Database Test
```
GET {{base_url}}/test-db
```

#### 3. Authentication
```
POST {{base_url}}/api/v1/auth/register
POST {{base_url}}/api/v1/auth/login
```

#### 4. Account Management
```
POST {{base_url}}/api/v1/accounts
GET {{base_url}}/api/v1/accounts/{id}
PATCH {{base_url}}/api/v1/accounts/{id}/balance
```

##  Troubleshooting

### Common Issues

1. **Server won't start**
   - Check if port 3001 is available
   - Verify environment variables are set
   - Check JWT_SECRET is properly configured

2. **Database connection fails**
   - Verify Supabase URL and keys
   - Check if tables exist in database
   - Run the SQL schema creation commands

3. **Authentication errors**
   - Ensure JWT_SECRET is set and not a placeholder
   - Check if user exists in database
   - Verify token format in Authorization header

### Debug Commands

```bash
# Test environment loading
node -e "require('dotenv').config(); console.log('ENV loaded:', process.env.NODE_ENV);"

# Test Supabase connection
node test-connection.js

# Start simple server for basic testing
node simple-server.js
```

##  API Endpoints Overview

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user

### Account Management
- `POST /api/v1/accounts` - Create account
- `GET /api/v1/accounts/:id` - Get account by ID
- `GET /api/v1/accounts/customer/:id` - Get customer accounts
- `PATCH /api/v1/accounts/:id/balance` - Update balance

### Customer Management
- `POST /api/v1/customers` - Create customer
- `GET /api/v1/customers` - Get all customers
- `GET /api/v1/customers/:id` - Get customer by ID

### Transaction Management
- `POST /api/v1/transactions` - Create transaction
- `GET /api/v1/transactions/account/:id` - Get account transactions

### System
- `GET /health` - Health check
- `GET /test-db` - Database connection test

##  Next Steps

1. Environment configured
2. Database schema created
3. Postman collection ready
4. Start backend server
5. Test API endpoints
6. Verify database operations
7. Test authentication flow

##  Notes

- The backend uses JWT for authentication
- All protected routes require `Authorization: Bearer <token>` header
- Database uses UUID for primary keys
- Supabase handles database operations
- CORS is configured for localhost development

##  Support

If you encounter issues:
1. Check the logs in `backend 1/backend2/backend/logs/`
2. Verify environment variables
3. Test database connection separately
4. Use the simple server for basic connectivity tests
