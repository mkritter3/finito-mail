#!/bin/bash

# 🔍 Tool Verification Script
# Tests commands and generates status report for live documentation generation

set -e

REPORT_FILE="verification_report.json"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "🔍 Starting tool verification at $TIMESTAMP"

# Initialize report
cat > "$REPORT_FILE" << EOF
{
  "verification_timestamp": "$TIMESTAMP",
  "verification_status": "in_progress",
  "commands": {},
  "tools": {},
  "environment": {}
}
EOF

# Helper function to test command with timeout
test_command() {
    local cmd="$1"
    local timeout="${2:-10}"
    local description="$3"
    
    echo "  Testing: $cmd"
    
    if timeout "$timeout" bash -c "$cmd" >/dev/null 2>&1; then
        echo "    ✅ SUCCESS"
        jq --arg cmd "$cmd" --arg desc "$description" \
           '.commands[$cmd] = {"status": "success", "description": $desc, "verified_at": "'$TIMESTAMP'"}' \
           "$REPORT_FILE" > tmp.$$ && mv tmp.$$ "$REPORT_FILE"
    else
        echo "    ❌ FAILED"
        jq --arg cmd "$cmd" --arg desc "$description" \
           '.commands[$cmd] = {"status": "failed", "description": $desc, "verified_at": "'$TIMESTAMP'"}' \
           "$REPORT_FILE" > tmp.$$ && mv tmp.$$ "$REPORT_FILE"
    fi
}

# Test basic environment commands
echo "📋 Testing Environment Commands:"
test_command "docker --version" 5 "Docker availability"
test_command "node --version" 5 "Node.js availability"
test_command "npm --version" 5 "npm availability"

# Test container-specific commands (if running in container)
if [ -f "/.dockerenv" ]; then
    echo "📦 Testing Container Commands:"
    test_command "claude --version" 5 "Claude CLI availability"
    test_command "which gemini" 5 "Gemini CLI availability"
    test_command "which appium" 5 "Appium availability"
fi

# Test GUI environment (only on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🖥️  Testing GUI Environment:"
    test_command "xhost +localhost" 5 "X11 forwarding setup"
    test_command "echo \$DISPLAY" 3 "Display environment variable"
fi

# Test development tools
echo "🛠️  Testing Development Tools:"
test_command "git --version" 5 "Git availability"
test_command "python3 --version" 5 "Python availability"

# Test problematic commands (expect these to fail)
echo "⚠️  Testing Known Problematic Commands:"
if timeout 5 claude /mcp >/dev/null 2>&1; then
    jq '.commands["claude /mcp"] = {"status": "unexpected_success", "description": "MCP tool access", "verified_at": "'$TIMESTAMP'"}' \
       "$REPORT_FILE" > tmp.$$ && mv tmp.$$ "$REPORT_FILE"
    echo "    ⚠️  UNEXPECTED SUCCESS: claude /mcp"
else
    jq '.commands["claude /mcp"] = {"status": "confirmed_timeout", "description": "MCP tool access (expected to fail)", "verified_at": "'$TIMESTAMP'"}' \
       "$REPORT_FILE" > tmp.$$ && mv tmp.$$ "$REPORT_FILE"
    echo "    ✅ CONFIRMED TIMEOUT: claude /mcp (as expected)"
fi

# Test verified working commands
echo "✅ Testing Verified Commands:"
if command -v e2e-test >/dev/null 2>&1; then
    test_command "e2e-test --help" 5 "E2E testing tool"
fi

if command -v autonomous-debug >/dev/null 2>&1; then
    test_command "autonomous-debug --help" 5 "Autonomous debug tool"  
fi

# Update environment info
jq --arg timestamp "$TIMESTAMP" \
   --arg os "$OSTYPE" \
   --arg pwd "$PWD" \
   '.environment = {"os": $os, "working_directory": $pwd, "is_container": "'$([ -f "/.dockerenv" ] && echo "true" || echo "false")'"}' \
   "$REPORT_FILE" > tmp.$$ && mv tmp.$$ "$REPORT_FILE"

# Finalize report
jq '.verification_status = "completed"' "$REPORT_FILE" > tmp.$$ && mv tmp.$$ "$REPORT_FILE"

echo "📊 Verification completed. Report saved to $REPORT_FILE"
echo "📈 Summary:"
echo "  ✅ Successful: $(jq -r '.commands | to_entries | map(select(.value.status == "success")) | length' "$REPORT_FILE")"
echo "  ❌ Failed: $(jq -r '.commands | to_entries | map(select(.value.status == "failed")) | length' "$REPORT_FILE")"
echo "  ⚠️  Confirmed Issues: $(jq -r '.commands | to_entries | map(select(.value.status == "confirmed_timeout")) | length' "$REPORT_FILE")"