#!/bin/bash

echo "🌐 Testing API Endpoints with Different Roles"
echo "=============================================="

# Wait for server to start
sleep 2

# Test 1: CEO accessing any user's data (should work)
echo -e "\n👑 Test 1: CEO accessing user data"
curl -s -H "x-user-id: ceo_test" \
     -H "x-session-id: test_session" \
     "http://localhost:3001/api/users/user_alice/analytics" | \
     jq '.requesting_user, .user_id, .error // "SUCCESS"'

# Test 2: User accessing their own data (should work)
echo -e "\n👤 Test 2: User accessing own data"
curl -s -H "x-user-id: user_alice" \
     -H "x-session-id: test_session" \
     "http://localhost:3001/api/users/user_alice/analytics" | \
     jq '.requesting_user, .user_id, .error // "SUCCESS"'

# Test 3: User accessing another user's data (should fail)
echo -e "\n🚫 Test 3: User accessing other user's data (should fail)"
curl -s -H "x-user-id: user_alice" \
     -H "x-session-id: test_session" \
     "http://localhost:3001/api/users/user_bob/analytics" | \
     jq '.error // "SECURITY BREACH!"'

# Test 4: No authentication (should fail)
echo -e "\n❌ Test 4: No authentication (should fail)"
curl -s "http://localhost:3001/api/users/user_alice/analytics" | \
     jq '.error'

# Test 5: Team analytics with CEO (should work)
echo -e "\n📊 Test 5: Team analytics with CEO access"
curl -s -H "x-user-id: ceo_test" \
     -H "x-session-id: test_session" \
     "http://localhost:3001/api/team/analytics" | \
     jq '.requesting_user, .team_analytics.total_users // "No data", .error // "SUCCESS"'

# Test 6: Team analytics with regular user (should fail)
echo -e "\n🚫 Test 6: Team analytics with user access (should fail)"
curl -s -H "x-user-id: user_alice" \
     -H "x-session-id: test_session" \
     "http://localhost:3001/api/team/analytics" | \
     jq '.error // "SECURITY BREACH!"'

echo -e "\n✅ API testing completed!"
