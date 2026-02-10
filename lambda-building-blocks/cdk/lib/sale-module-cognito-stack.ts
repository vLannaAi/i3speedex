import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface SaleModuleCognitoStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
}

export class SaleModuleCognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly adminGroup: cognito.CfnUserPoolGroup;
  public readonly operatorGroup: cognito.CfnUserPoolGroup;
  public readonly viewerGroup: cognito.CfnUserPoolGroup;

  constructor(scope: Construct, id: string, props: SaleModuleCognitoStackProps) {
    super(scope, id, props);

    const { environment } = props;
    const isProd = environment === 'prod';

    // ========================================
    // User Pool
    // ========================================
    this.userPool = new cognito.UserPool(this, 'SaleModuleUserPool', {
      userPoolName: `i2speedex-sale-module-${environment}`,

      // Sign-in configuration
      signInAliases: {
        email: true,
        username: false,
      },

      // Auto-verified attributes
      autoVerify: {
        email: true,
      },

      // User attributes
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },

      // Custom attributes
      customAttributes: {
        'operatorId': new cognito.NumberAttribute({ min: 1, max: 999, mutable: true }),
        'role': new cognito.StringAttribute({ minLen: 3, maxLen: 20, mutable: true }),
        'permissions': new cognito.StringAttribute({ minLen: 0, maxLen: 500, mutable: true }),
      },

      // Password policy
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(7),
      },

      // Account recovery
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      // Self-service sign-up
      selfSignUpEnabled: false, // Admin-only user creation for now

      // MFA configuration
      mfa: isProd ? cognito.Mfa.OPTIONAL : cognito.Mfa.OFF,
      mfaSecondFactor: {
        sms: false,
        otp: true, // TOTP (Google Authenticator, Authy, etc.)
      },

      // Email configuration
      email: cognito.UserPoolEmail.withCognito(),

      // User invitation
      userInvitation: {
        emailSubject: 'Welcome to i2speedex Sale Module',
        emailBody: `
Hello {username},

You have been invited to join i2speedex Sale Module.

Your temporary password is: {####}

Please log in and change your password.

Environment: ${environment}

Best regards,
The i2speedex Team
        `.trim(),
      },

      // User verification
      userVerification: {
        emailSubject: 'Verify your email for i2speedex',
        emailBody: 'Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },

      // Advanced security
      advancedSecurityMode: isProd
        ? cognito.AdvancedSecurityMode.ENFORCED
        : cognito.AdvancedSecurityMode.AUDIT,

      // Device tracking
      deviceTracking: {
        challengeRequiredOnNewDevice: isProd,
        deviceOnlyRememberedOnUserPrompt: true,
      },

      // Deletion protection
      deletionProtection: isProd,
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // App Client (Frontend - Nuxt)
    // ========================================
    this.userPoolClient = this.userPool.addClient('FrontendClient', {
      userPoolClientName: `i2speedex-frontend-${environment}`,

      // Auth flows
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: false,
        adminUserPassword: false,
      },

      // OAuth configuration
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:3000/auth/callback',
          environment === 'prod' ? 'https://sales.i2speedex.com/auth/callback' : `https://${environment}-sales.i2speedex.com/auth/callback`,
        ],
        logoutUrls: [
          'http://localhost:3000',
          environment === 'prod' ? 'https://sales.i2speedex.com' : `https://${environment}-sales.i2speedex.com`,
        ],
      },

      // Token validity
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      // Prevent user existence errors
      preventUserExistenceErrors: true,

      // Enable token revocation
      enableTokenRevocation: true,

      // Read/write attributes
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          emailVerified: true,
          givenName: true,
          familyName: true,
        })
        .withCustomAttributes('operatorId', 'role', 'permissions'),

      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          givenName: true,
          familyName: true,
        }),
    });

    // ========================================
    // App Client (Backend - Lambda)
    // ========================================
    const backendClient = this.userPool.addClient('BackendClient', {
      userPoolClientName: `i2speedex-backend-${environment}`,

      authFlows: {
        userPassword: false,
        userSrp: false,
        custom: false,
        adminUserPassword: true, // For admin operations
      },

      generateSecret: false, // No secret needed for Lambda

      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      preventUserExistenceErrors: true,
    });

    // ========================================
    // User Pool Domain
    // ========================================
    this.userPoolDomain = this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `i2speedex-sale-${environment}`,
      },
    });

    // ========================================
    // User Groups (RBAC)
    // ========================================

    // Admin Group - Full access
    this.adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admin',
      description: 'Administrators with full access',
      precedence: 1,
    });

    // Operator Group - Can create/edit sales
    this.operatorGroup = new cognito.CfnUserPoolGroup(this, 'OperatorGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'operator',
      description: 'Operators who can create and edit sales',
      precedence: 2,
    });

    // Viewer Group - Read-only access
    this.viewerGroup = new cognito.CfnUserPoolGroup(this, 'ViewerGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'viewer',
      description: 'Viewers with read-only access',
      precedence: 3,
    });

    // ========================================
    // Pre-Authentication Lambda Trigger (Optional)
    // ========================================
    // Can be added later to:
    // - Check if user is allowed to log in
    // - Enforce IP whitelisting
    // - Custom authentication logic

    // ========================================
    // Post-Confirmation Lambda Trigger (Optional)
    // ========================================
    // Can be added later to:
    // - Create user record in DynamoDB Users table
    // - Send welcome email
    // - Initialize user preferences

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `UserPoolId-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `UserPoolArn-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Frontend App Client ID',
      exportName: `UserPoolClientId-${environment}`,
    });

    new cdk.CfnOutput(this, 'BackendClientId', {
      value: backendClient.userPoolClientId,
      description: 'Backend App Client ID',
      exportName: `BackendClientId-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolDomainUrl', {
      value: `https://${this.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Hosted UI URL',
      exportName: `UserPoolDomainUrl-${environment}`,
    });

    new cdk.CfnOutput(this, 'UserPoolProviderUrl', {
      value: this.userPool.userPoolProviderUrl,
      description: 'Cognito User Pool Provider URL (for OIDC)',
      exportName: `UserPoolProviderUrl-${environment}`,
    });

    // ========================================
    // Tags
    // ========================================
    cdk.Tags.of(this).add('Project', 'i2speedex-sale-module');
    cdk.Tags.of(this).add('Component', 'cognito-auth');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
