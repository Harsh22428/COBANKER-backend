#  CoBanker Postman Collection Setup Guide

##  Quick Start (5 Minutes)

### Step 1: Import Collection & Environment
1. **Open Postman**
2. **Import Collection**:
   - Click "Import" → Select `CoBanker-Backend-API.postman_collection.json`
3. **Import Environment**:
   - Click "Import" → Select `CoBanker-Local.postman_environment.json`
4. **Select Environment**: Choose "CoBanker Local" from dropdown

### Step 2: Start Backend Server
```bash
cd "backend 1/backend2/backend"
node final-test.js
```
**Expected Output:**
```
 CoBanker Backend Server Started!
 Server: http://localhost:3001
 Health: http://localhost:3001/health
 Ready for testing!
```

### Step 3: Test Basic Endpoints
1. **Health Check**: `GET /health` → Should return `status: healthy`
2. **Server Status**: `GET /` → Should return server info
3. **Database Test**: `GET /test-db` → Should show database tables

##  Current Server Status

 **Server**: Running on http://localhost:3001  
 **Database**: Connected to Supabase  
 **Tables**: 13 tables created successfully  
 **Environment**: Development mode  

##  Available Endpoints

### Health & System
- `GET /health` - Server health check
- `GET /` - Server status and info

### Database Testing  
- `GET /test-db` - Test database connection
- `POST /test-create-customer` - Create test customer

##  Next Steps

### 1. Test Current Setup
Run these requests in order:
1. Health Check
2. Server Status  
3. Test Database Connection

### 2. Verify Results
- All requests should return 200 OK
- Database test should show all tables
- No authentication errors

### 3. Ready for Development
Once basic tests pass, you can:
- Add more endpoints to collection
- Test CRUD operations
- Implement authentication flow

##  Troubleshooting

### Server Not Starting
```bash
# Check if port 3001 is in use
netstat -ano | findstr :3001

# Kill process if needed
taskkill /PID <process_id> /F

# Restart server
node final-test.js
```

### Database Connection Issues
```bash
# Test database connection
node test-db-simple.js

# Expected: "RESULT: Connection successful"
```

### Environment Variables
Check `.env` file contains:
- `SUPABASE_URL=https://ubplpvhynmwqmpgwrotj.supabase.co`
- `SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...`
- `PORT=3001`

##  Collection Features

### Auto-Variable Setting
- Login responses automatically save `auth_token`
- Customer creation saves `customer_id`
- Account creation saves `account_id`

### Global Scripts
- **Pre-request**: Logs request name and sets timestamp
- **Tests**: Validates response time and JSON format

### Environment Variables
| Variable | Purpose | Auto-Set |
|----------|---------|----------|
| `base_url` | Server URL | No |
| `api_version` | API version | No |
| `auth_token` | JWT token | Yes (after login) |
| `customer_id` | Customer ID | Yes (after creation) |
| `account_id` | Account ID | Yes (after creation) |

##  Success Indicators

 Health check returns `200 OK`  
 Database test shows all 13 tables  
 Server uptime > 0 seconds  
 No connection errors in console  

**You're ready to start API testing!** 
