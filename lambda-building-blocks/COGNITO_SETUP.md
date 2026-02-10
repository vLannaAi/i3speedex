# i2speedex Sale Module - AWS Cognito Setup

## Authentication & Authorization

**Date**: January 28, 2026
**Status**: ✅ Cognito User Pool Deployed
**Environment**: Development (dev)

---

## Deployed Resources

### Cognito User Pool
**Pool Name**: `i2speedex-sale-module-dev`
**Pool ID**: `eu-west-1_5C3HQsAtE`
**ARN**: `arn:aws:cognito-idp:eu-west-1:827562051115:userpool/eu-west-1_5C3HQsAtE`
**Region**: eu-west-1
**Status**: ✅ ACTIVE

### Authentication Configuration

**Sign-in Method**: Email address
**Self-registration**: ❌ Disabled (admin-only user creation)
**MFA**: ❌ OFF (dev), ✅ OPTIONAL (prod)
**MFA Methods**: TOTP (Google Authenticator, Authy)
**Email Verification**: ✅ Required
**Password Recovery**: Email-only

### Password Policy

- Minimum length: 8 characters
- Requires lowercase: ✅ Yes
- Requires uppercase: ✅ Yes
- Requires digits: ✅ Yes
- Requires symbols: ❌ No
- Temporary password validity: 7 days

### User Attributes

**Standard Attributes**:
- Email (required, mutable, verified)
- Given Name (optional, mutable)
- Family Name (optional, mutable)

**Custom Attributes**:
- `custom:operatorId` - Number (1-999, mutable)
- `custom:role` - String (3-20 chars, mutable)
- `custom:permissions` - String (0-500 chars, mutable)

---

## App Clients

### 1. Frontend Client (Nuxt App)
**Client ID**: `1ut7n5a1tpb0i48mqctol09eua`
**Client Name**: `i2speedex-frontend-dev`
**Purpose**: Authentication for Nuxt 4 web application

**Auth Flows**:
- ✅ USER_PASSWORD_AUTH (username/password)
- ✅ USER_SRP_AUTH (Secure Remote Password)
- ❌ CUSTOM_AUTH
- ❌ ADMIN_NO_SRP_AUTH

**OAuth 2.0 Configuration**:
- Grant Types: Authorization Code Grant
- Scopes: email, openid, profile
- Callback URLs:
  - `http://localhost:3000/auth/callback` (local dev)
  - `https://dev-sales.i2speedex.com/auth/callback` (dev)
- Logout URLs:
  - `http://localhost:3000`
  - `https://dev-sales.i2speedex.com`

**Token Validity**:
- Access Token: 1 hour
- ID Token: 1 hour
- Refresh Token: 30 days

### 2. Backend Client (Lambda Functions)
**Client ID**: `6tbkr4cnbin2hig0nlgoltg733`
**Client Name**: `i2speedex-backend-dev`
**Purpose**: Server-side authentication for Lambda functions

**Auth Flows**:
- ✅ ADMIN_NO_SRP_AUTH (admin operations)
- ❌ USER_PASSWORD_AUTH
- ❌ USER_SRP_AUTH
- ❌ CUSTOM_AUTH

**Token Validity**:
- Access Token: 1 hour
- ID Token: 1 hour
- Refresh Token: 30 days

---

## Hosted UI

### Cognito Domain
**Domain**: `i2speedex-sale-dev.auth.eu-west-1.amazoncognito.com`
**Hosted UI URL**: https://i2speedex-sale-dev.auth.eu-west-1.amazoncognito.com

### Login URL
```
https://i2speedex-sale-dev.auth.eu-west-1.amazoncognito.com/login?client_id=1ut7n5a1tpb0i48mqctol09eua&response_type=code&scope=email+openid+profile&redirect_uri=http://localhost:3000/auth/callback
```

### OIDC Provider URL
```
https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_5C3HQsAtE
```

---

## User Groups (RBAC)

### 1. Admin Group
**Group Name**: `admin`
**Precedence**: 1 (highest priority)
**Description**: Administrators with full access
**Permissions**:
- Full CRUD access to all resources
- User management
- System configuration
- View all data

### 2. Operator Group
**Group Name**: `operator`
**Precedence**: 2
**Description**: Operators who can create and edit sales
**Permissions**:
- Create/edit/delete sales
- Create/edit buyers and producers
- Generate invoices and documents
- View all data
- Cannot manage users or system settings

### 3. Viewer Group
**Group Name**: `viewer`
**Precedence**: 3 (lowest priority)
**Description**: Viewers with read-only access
**Permissions**:
- View sales, buyers, producers
- View invoices and documents
- Cannot create, edit, or delete anything

---

## Test Users

### Admin User
**Email**: `admin@i2speedex.com`
**Username**: `admin@i2speedex.com`
**Temporary Password**: `TempPass123!`
**Group**: admin
**Status**: FORCE_CHANGE_PASSWORD (must change on first login)

**Note**: This is a test user for development only. Change the password immediately on first login.

---

## Integration with Nuxt 4

### Install Dependencies

```bash
npm install @aws-amplify/auth @aws-amplify/core
```

### Configure Amplify

```typescript
// plugins/amplify.ts
import { Amplify } from '@aws-amplify/core';
import { fetchAuthSession } from '@aws-amplify/auth';

export default defineNuxtPlugin(() => {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: 'eu-west-1_5C3HQsAtE',
        userPoolClientId: '1ut7n5a1tpb0i48mqctol09eua',
        signUpVerificationMethod: 'code',
        loginWith: {
          email: true,
          oauth: {
            domain: 'i2speedex-sale-dev.auth.eu-west-1.amazoncognito.com',
            scopes: ['email', 'openid', 'profile'],
            redirectSignIn: ['http://localhost:3000/auth/callback'],
            redirectSignOut: ['http://localhost:3000'],
            responseType: 'code',
          },
        },
      },
    },
  });
});
```

### Authentication Composable

```typescript
// composables/useAuth.ts
import { signIn, signOut, getCurrentUser, fetchAuthSession } from '@aws-amplify/auth';

export const useAuth = () => {
  const user = ref(null);
  const isAuthenticated = computed(() => !!user.value);

  const login = async (email: string, password: string) => {
    try {
      const { isSignedIn } = await signIn({ username: email, password });
      if (isSignedIn) {
        await loadUser();
      }
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error };
    }
  };

  const logout = async () => {
    try {
      await signOut();
      user.value = null;
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();

      user.value = {
        username: currentUser.username,
        email: currentUser.signInDetails?.loginId,
        groups: session.tokens?.accessToken?.payload['cognito:groups'] || [],
      };
    } catch (error) {
      user.value = null;
    }
  };

  const hasRole = (role: string) => {
    return user.value?.groups?.includes(role) || false;
  };

  return {
    user,
    isAuthenticated,
    login,
    logout,
    loadUser,
    hasRole,
  };
};
```

### Protected Route Middleware

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware(async (to, from) => {
  const { isAuthenticated, loadUser } = useAuth();

  if (!isAuthenticated.value) {
    await loadUser();
  }

  if (!isAuthenticated.value) {
    return navigateTo('/login');
  }
});
```

### Login Page Example

```vue
<!-- pages/login.vue -->
<template>
  <div class="login-container">
    <h1>i2speedex Sale Module</h1>
    <form @submit.prevent="handleLogin">
      <input
        v-model="email"
        type="email"
        placeholder="Email"
        required
      />
      <input
        v-model="password"
        type="password"
        placeholder="Password"
        required
      />
      <button type="submit" :disabled="loading">
        {{ loading ? 'Logging in...' : 'Login' }}
      </button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const { login } = useAuth();
const router = useRouter();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const handleLogin = async () => {
  loading.value = true;
  error.value = '';

  const result = await login(email.value, password.value);

  if (result.success) {
    router.push('/');
  } else {
    error.value = result.error?.message || 'Login failed';
  }

  loading.value = false;
};
</script>
```

---

## Integration with Lambda Functions

### Get User from JWT Token

```typescript
// Lambda handler
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: 'eu-west-1_5C3HQsAtE',
  tokenUse: 'access',
  clientId: '6tbkr4cnbin2hig0nlgoltg733',
});

export async function handler(event: APIGatewayProxyEvent) {
  try {
    // Get token from Authorization header
    const token = event.headers.Authorization?.replace('Bearer ', '');

    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'No token provided' }),
      };
    }

    // Verify token
    const payload = await verifier.verify(token);

    // Extract user info
    const username = payload.username;
    const email = payload.email;
    const groups = payload['cognito:groups'] || [];

    // Check permissions
    if (!groups.includes('admin') && !groups.includes('operator')) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Insufficient permissions' }),
      };
    }

    // Continue with handler logic...

  } catch (error) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid token' }),
    };
  }
}
```

---

## User Management

### Create User (Admin Only)

```bash
aws cognito-idp admin-create-user \
  --user-pool-id eu-west-1_5C3HQsAtE \
  --username user@example.com \
  --user-attributes \
    Name=email,Value=user@example.com \
    Name=email_verified,Value=true \
    Name=given_name,Value=John \
    Name=family_name,Value=Doe \
  --temporary-password 'TempPass123!'
```

### Add User to Group

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id eu-west-1_5C3HQsAtE \
  --username user@example.com \
  --group-name operator
```

### List Users

```bash
aws cognito-idp list-users \
  --user-pool-id eu-west-1_5C3HQsAtE
```

### List Users in Group

```bash
aws cognito-idp list-users-in-group \
  --user-pool-id eu-west-1_5C3HQsAtE \
  --group-name admin
```

### Disable User

```bash
aws cognito-idp admin-disable-user \
  --user-pool-id eu-west-1_5C3HQsAtE \
  --username user@example.com
```

### Delete User

```bash
aws cognito-idp admin-delete-user \
  --user-pool-id eu-west-1_5C3HQsAtE \
  --username user@example.com
```

### Reset User Password

```bash
aws cognito-idp admin-reset-user-password \
  --user-pool-id eu-west-1_5C3HQsAtE \
  --username user@example.com
```

---

## Security Best Practices

### For Production

1. **Enable MFA**: Change MFA from OFF to OPTIONAL or REQUIRED
2. **Enable Advanced Security**: For bot detection and compromised credentials
3. **Implement Rate Limiting**: Protect against brute force attacks
4. **Use HTTPS Only**: Ensure all OAuth redirects use HTTPS
5. **Rotate Secrets**: Regularly rotate app client secrets (if using)
6. **Monitor Login Attempts**: Set up CloudWatch alarms for failed logins
7. **Enable Deletion Protection**: Prevent accidental user pool deletion

### Token Management

- Store tokens securely (HttpOnly cookies or secure storage)
- Never expose tokens in URLs
- Implement token refresh logic
- Clear tokens on logout
- Validate tokens on every API call

### User Groups & Permissions

- Follow principle of least privilege
- Assign users to appropriate groups only
- Regularly audit user permissions
- Remove inactive users
- Log all admin operations

---

## Cost Estimation

### Cognito User Pool Pricing

**Free Tier** (First 50,000 MAUs):
- Monthly Active Users (MAU): FREE
- Advanced Security Features: $0.05 per MAU

**Beyond Free Tier**:
- MAU 50,001 - 100,000: $0.0055 per MAU
- MAU 100,001+: $0.0046 per MAU

**Expected Cost for i2speedex**:
- Estimated users: 5-10
- Monthly cost: **$0.00** (well within free tier)

---

## Monitoring & Logs

### CloudWatch Metrics

Available metrics:
- SignInSuccesses
- SignInThrottles
- TokenRefreshSuccesses
- UserAuthentication

### View Logs

```bash
# List log groups
aws logs describe-log-groups --log-group-name-prefix /aws/cognito

# Tail logs
aws logs tail /aws/cognito/userpools/eu-west-1_5C3HQsAtE --follow
```

---

## Troubleshooting

### User Cannot Login

1. Check user status: `aws cognito-idp admin-get-user`
2. Verify email is confirmed
3. Check password policy compliance
4. Verify user is enabled (not disabled/deleted)

### Invalid Token Errors

1. Verify token hasn't expired
2. Check token was issued by correct user pool
3. Verify client ID matches
4. Ensure token hasn't been revoked

### MFA Issues

1. Verify MFA is enabled for user
2. Check TOTP code is time-synced
3. Ensure backup codes are available

---

## Next Steps

- [ ] Configure custom domain for Cognito Hosted UI
- [ ] Set up email templates (welcome, verification, password reset)
- [ ] Configure Lambda triggers (pre-auth, post-confirmation)
- [ ] Set up CloudWatch alarms for security events
- [ ] Implement social identity providers (Google, Facebook) if needed
- [ ] Create user management UI in Nuxt app

---

## Links

- **Cognito Console**: https://eu-west-1.console.aws.amazon.com/cognito/v2/idp/user-pools/eu-west-1_5C3HQsAtE/users
- **Hosted UI**: https://i2speedex-sale-dev.auth.eu-west-1.amazoncognito.com
- **CloudFormation Stack**: https://eu-west-1.console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/stackinfo?stackId=arn:aws:cloudformation:eu-west-1:827562051115:stack/SaleModuleCognito-Dev/33988c90-fc64-11f0-bff8-0aa80135679f

---

**Status**: ✅ Cognito User Pool Deployed & Configured
**Deployment Date**: January 28, 2026, 23:13 UTC
**Deployed By**: Claude Code
**Environment**: Development (dev)
**Test User Created**: admin@i2speedex.com
**Next**: Set up API Gateway with Cognito authorizer
