#!/bin/bash

# Test script for process-changes-enhanced endpoint
# Usage: ./test-endpoint.sh

echo "🧪 Testing process-changes-enhanced endpoint..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:8888"
ENDPOINT="/.netlify/functions/process-changes-enhanced"

echo -e "${BLUE}Testing endpoint: ${BASE_URL}${ENDPOINT}${NC}"
echo ""

# Test if server is running
echo -e "${YELLOW}🔍 Checking if server is running...${NC}"
curl -s --connect-timeout 5 "${BASE_URL}/.netlify/functions/web-status" > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not running on ${BASE_URL}${NC}"
    echo -e "${YELLOW}Please start the server with: netlify dev${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📤 Sending POST request with sample payload...${NC}"
echo ""

# Send the POST request
response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d @sample-payload.json \
    "${BASE_URL}${ENDPOINT}")

# Extract the body and status
http_body=$(echo $response | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
http_status=$(echo $response | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')

echo -e "${BLUE}📥 HTTP Status: ${http_status}${NC}"
echo ""

if [ "$http_status" -eq 200 ]; then
    echo -e "${GREEN}✅ SUCCESS!${NC}"
    echo ""
    echo -e "${BLUE}📄 Response:${NC}"
    echo "$http_body" | jq '.' 2>/dev/null || echo "$http_body"
    
    # Try to extract session ID for polling test
    session_id=$(echo "$http_body" | jq -r '.sessionId' 2>/dev/null)
    if [ "$session_id" != "null" ] && [ "$session_id" != "" ]; then
        echo ""
        echo -e "${YELLOW}🔄 Testing session polling for ID: ${session_id}${NC}"
        echo ""
        
        polling_response=$(curl -s -w "HTTPSTATUS:%{http_code}" "${BASE_URL}${ENDPOINT}/${session_id}")
        polling_body=$(echo $polling_response | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
        polling_status=$(echo $polling_response | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
        
        echo -e "${BLUE}📥 Polling Status: ${polling_status}${NC}"
        echo ""
        echo -e "${BLUE}📊 Session Data:${NC}"
        echo "$polling_body" | jq '.' 2>/dev/null || echo "$polling_body"
    fi
    
else
    echo -e "${RED}❌ FAILED!${NC}"
    echo ""
    echo -e "${RED}📄 Error Response:${NC}"
    echo "$http_body" | jq '.' 2>/dev/null || echo "$http_body"
fi

echo ""
echo -e "${BLUE}🏁 Test completed${NC}"