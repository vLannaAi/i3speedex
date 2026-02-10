# AWS Presence System Setup

This document describes how to set up the AWS infrastructure required for the real-time operator presence system.

## Overview

The presence system uses:
- **AWS IoT Core** - MQTT over WebSocket for real-time messaging
- **Amazon Cognito Identity Pool** - Provides temporary AWS credentials to browsers
- **IAM Role** - Permissions for IoT Core access

## Prerequisites

- AWS CLI installed and configured
- AWS profile `speedex_root` with admin access (or adjust commands for your profile)

## Step 1: Create Cognito Identity Pool

```bash
# Create the identity pool with unauthenticated access enabled
aws cognito-identity create-identity-pool \
  --identity-pool-name speedex-presence-pool \
  --allow-unauthenticated-identities \
  --profile speedex_root \
  --region eu-south-1

# Note the IdentityPoolId from the output (format: eu-south-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
```

Save the `IdentityPoolId` - you'll need it for the next steps and for the XSLT configuration.

## Step 2: Create IAM Role for Unauthenticated Access

### 2.1 Create the trust policy file

Create a file `trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "YOUR_IDENTITY_POOL_ID"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "unauthenticated"
        }
      }
    }
  ]
}
```

Replace `YOUR_IDENTITY_POOL_ID` with the actual Identity Pool ID.

### 2.2 Create the role

```bash
aws iam create-role \
  --role-name speedex-presence-unauth-role \
  --assume-role-policy-document file://trust-policy.json \
  --profile speedex_root
```

### 2.3 Create the permissions policy file

Create a file `permissions-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:Connect"
      ],
      "Resource": "arn:aws:iot:eu-south-1:YOUR_ACCOUNT_ID:client/speedex_*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Publish",
        "iot:Receive"
      ],
      "Resource": "arn:aws:iot:eu-south-1:YOUR_ACCOUNT_ID:topic/speedex/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Subscribe"
      ],
      "Resource": "arn:aws:iot:eu-south-1:YOUR_ACCOUNT_ID:topicfilter/speedex/*"
    }
  ]
}
```

Replace `YOUR_ACCOUNT_ID` with your AWS account ID.

### 2.4 Attach the policy to the role

```bash
aws iam put-role-policy \
  --role-name speedex-presence-unauth-role \
  --policy-name speedex-presence-iot-policy \
  --policy-document file://permissions-policy.json \
  --profile speedex_root
```

## Step 3: Attach Role to Identity Pool

```bash
aws cognito-identity set-identity-pool-roles \
  --identity-pool-id YOUR_IDENTITY_POOL_ID \
  --roles unauthenticated=arn:aws:iam::YOUR_ACCOUNT_ID:role/speedex-presence-unauth-role \
  --profile speedex_root \
  --region eu-south-1
```

## Step 4: Get IoT Core Endpoint

```bash
aws iot describe-endpoint \
  --endpoint-type iot:Data-ATS \
  --profile speedex_root \
  --region eu-south-1
```

Note the `endpointAddress` from the output. This is your IoT endpoint.

## Step 5: Configure the Application

Update the `sx_presence_config` element in `webapps/sp/xslt/_inc/skin_frame2.xslt`:

```xml
<div id="sx_presence_config"
     data-iot-endpoint="YOUR_IOT_ENDPOINT"
     data-cognito-pool-id="YOUR_IDENTITY_POOL_ID"
     data-aws-region="eu-south-1"
     style="display:none;"></div>
```

Replace:
- `YOUR_IOT_ENDPOINT` with the endpoint from Step 4
- `YOUR_IDENTITY_POOL_ID` with the Identity Pool ID from Step 1

## Verification

### Test IoT Endpoint

```bash
# Verify the endpoint is accessible
aws iot describe-endpoint --endpoint-type iot:Data-ATS --profile speedex_root --region eu-south-1
```

### Test Cognito Pool

```bash
# List identity pools to verify creation
aws cognito-identity list-identity-pools --max-results 10 --profile speedex_root --region eu-south-1
```

### Browser Console Debug

Open the browser developer console and check for:

```javascript
// Check presence state
console.log(SX_PRESENCE.viewers);
console.log(SX_PRESENCE.connected);
```

## Security Considerations

1. **Unauthenticated Access**: The Cognito pool uses unauthenticated access because operators are already authenticated via the webapp's basic auth. Only internal operators have access to the webapp.

2. **Topic Restrictions**: The IAM policy restricts access to only `speedex/*` topics.

3. **Client ID Prefix**: Clients can only connect with IDs starting with `speedex_`.

4. **No Sensitive Data**: Only operator names and message IDs are transmitted - no sensitive data.

## Cost Estimate

AWS IoT Core pricing (eu-south-1):
- Connectivity: $0.08 per million minutes
- Messaging: $1.00 per million messages

Estimated monthly cost for 10 operators, 8 hours/day, 22 working days: **< $5/month**

## Troubleshooting

### Connection Issues

1. Check browser console for errors
2. Verify Cognito pool ID and IoT endpoint are correct
3. Verify IAM role permissions
4. Check CORS settings if needed

### Messages Not Received

1. Verify subscription to `speedex/presence` topic
2. Check IAM policy allows Subscribe and Receive
3. Verify topic name matches in publish and subscribe

### Credentials Expired

The AWS SDK automatically refreshes Cognito credentials. If issues persist, try refreshing the page.

## Topic Structure

All presence messages use a single topic: `speedex/presence`

### Message Types

**Join** (when opening message detail):
```json
{
  "action": "join",
  "msgId": "1576438",
  "opUd": "21",
  "opName": "stefy",
  "tabId": "tab_x7k2m9p3q",
  "timestamp": 1706400000000
}
```

**Leave** (when closing tab or navigating away):
```json
{
  "action": "leave",
  "msgId": "1576438",
  "opUd": "21",
  "tabId": "tab_x7k2m9p3q",
  "timestamp": 1706400060000
}
```

**Heartbeat** (every 30 seconds):
```json
{
  "action": "heartbeat",
  "msgId": "1576438",
  "opUd": "21",
  "tabId": "tab_x7k2m9p3q",
  "timestamp": 1706400030000
}
```

**Sync Request** (on page load):
```json
{
  "action": "sync_request",
  "requesterId": "tab_x7k2m9p3q"
}
```

**Sync Response** (reply with current state):
```json
{
  "action": "sync_response",
  "msgId": "1576438",
  "opUd": "10",
  "opName": "gigi",
  "tabId": "tab_a1b2c3d4e",
  "joinedAt": 1706399000000,
  "requesterId": "tab_x7k2m9p3q"
}
```

## Quick Setup Script

For convenience, here's a complete setup script. Save as `setup-presence.sh`:

```bash
#!/bin/bash

# Configuration
PROFILE="speedexroot"
REGION="eu-west-1"
POOL_NAME="speedex-presence-pool"
ROLE_NAME="speedex-presence-unauth-role"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $PROFILE --query "Account" --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Step 1: Create Cognito Identity Pool
echo "Creating Cognito Identity Pool..."
POOL_ID=$(aws cognito-identity create-identity-pool \
  --identity-pool-name $POOL_NAME \
  --allow-unauthenticated-identities \
  --profile $PROFILE \
  --region $REGION \
  --query "IdentityPoolId" \
  --output text)
echo "Identity Pool ID: $POOL_ID"

# Step 2: Create Trust Policy
cat > /tmp/trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "$POOL_ID"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "unauthenticated"
        }
      }
    }
  ]
}
EOF

# Step 3: Create IAM Role
echo "Creating IAM Role..."
aws iam create-role \
  --role-name $ROLE_NAME \
  --assume-role-policy-document file:///tmp/trust-policy.json \
  --profile $PROFILE

# Step 4: Create Permissions Policy
cat > /tmp/permissions-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["iot:Connect"],
      "Resource": "arn:aws:iot:$REGION:$ACCOUNT_ID:client/speedex_*"
    },
    {
      "Effect": "Allow",
      "Action": ["iot:Publish", "iot:Receive"],
      "Resource": "arn:aws:iot:$REGION:$ACCOUNT_ID:topic/speedex/*"
    },
    {
      "Effect": "Allow",
      "Action": ["iot:Subscribe"],
      "Resource": "arn:aws:iot:$REGION:$ACCOUNT_ID:topicfilter/speedex/*"
    }
  ]
}
EOF

# Step 5: Attach Policy to Role
echo "Attaching policy to role..."
aws iam put-role-policy \
  --role-name $ROLE_NAME \
  --policy-name speedex-presence-iot-policy \
  --policy-document file:///tmp/permissions-policy.json \
  --profile $PROFILE

# Step 6: Attach Role to Identity Pool
echo "Attaching role to identity pool..."
aws cognito-identity set-identity-pool-roles \
  --identity-pool-id $POOL_ID \
  --roles unauthenticated=arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME \
  --profile $PROFILE \
  --region $REGION

# Step 7: Get IoT Endpoint
echo "Getting IoT endpoint..."
IOT_ENDPOINT=$(aws iot describe-endpoint \
  --endpoint-type iot:Data-ATS \
  --profile $PROFILE \
  --region $REGION \
  --query "endpointAddress" \
  --output text)

echo ""
echo "============================================"
echo "Setup Complete!"
echo "============================================"
echo ""
echo "Update skin_frame2.xslt with these values:"
echo ""
echo "  data-iot-endpoint=\"$IOT_ENDPOINT\""
echo "  data-cognito-pool-id=\"$POOL_ID\""
echo "  data-aws-region=\"$REGION\""
echo ""

# Cleanup temp files
rm -f /tmp/trust-policy.json /tmp/permissions-policy.json
```

Make it executable and run:

```bash
chmod +x setup-presence.sh
./setup-presence.sh
```
