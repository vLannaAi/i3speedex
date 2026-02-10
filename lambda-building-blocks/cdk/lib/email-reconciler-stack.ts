import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import * as path from 'path';

export interface EmailReconcilerStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
}

export class EmailReconcilerStack extends cdk.Stack {
  public readonly function: lambda.Function;
  public readonly httpApi: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: EmailReconcilerStackProps) {
    super(scope, id, props);

    const envSuffix = props.environment === 'prod' ? 'Prod' :
                      props.environment === 'staging' ? 'Staging' : 'Dev';

    // Create secret for sensitive configuration
    const configSecret = new secretsmanager.Secret(this, 'ConfigSecret', {
      secretName: `email-reconciler/${props.environment}/config`,
      description: 'Email Reconciler configuration secrets',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          DB_HOST: 'rdss2.speedex.it',
          DB_PORT: '3306',
          DB_USER: 'i2',
          DB_NAME: 'i2_speedex',
        }),
        generateStringKey: 'DB_PASSWORD',
      },
    });

    // Lambda function
    this.function = new lambda.Function(this, 'EmailReconcilerFunction', {
      functionName: `email-reconciler-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../functions/email-reconciler/dist')
      ),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: props.environment === 'prod' ? 'INFO' : 'DEBUG',
        ENVIRONMENT: props.environment,
        // DB credentials will be loaded from environment or secrets
        DB_HOST: 'rdss2.speedex.it',
        DB_PORT: '3306',
        DB_USER: 'i2',
        DB_NAME: 'i2_speedex',
        // Anthropic API key should be set via environment variable or secret
      },
      logRetention: props.environment === 'prod'
        ? logs.RetentionDays.ONE_MONTH
        : logs.RetentionDays.ONE_WEEK,
      description: 'AI-powered email recipient reconciliation agent',
    });

    // Grant secret read access
    configSecret.grantRead(this.function);

    // Add policy for Secrets Manager
    this.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [configSecret.secretArn],
    }));

    // HTTP API Gateway
    this.httpApi = new apigatewayv2.HttpApi(this, 'EmailReconcilerApi', {
      apiName: `email-reconciler-api-${props.environment}`,
      description: 'Email Reconciler API',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Reviewer-Id'],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigatewayv2_integrations.HttpLambdaIntegration(
      'LambdaIntegration',
      this.function
    );

    // Add routes
    // Health check
    this.httpApi.addRoutes({
      path: '/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // Queue routes
    this.httpApi.addRoutes({
      path: '/queue/pending',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/queue/bulk-approve',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/queue/cleanup',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/queue/domain/{domain}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/queue/{id}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/queue/{id}/approve',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/queue/{id}/reject',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/queue/{id}/modify',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/queue/{id}/audit',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // Process routes
    this.httpApi.addRoutes({
      path: '/process/msg-email/{id}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/process/preview/{id}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/process/batch',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/process/duplicates',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/process/splits',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/process/full',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    // Stats routes
    this.httpApi.addRoutes({
      path: '/stats',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/stats/domains',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/stats/summary',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/domains',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    this.httpApi.addRoutes({
      path: '/domains/{domain}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // Outputs
    new cdk.CfnOutput(this, 'FunctionName', {
      value: this.function.functionName,
      description: 'Lambda function name',
      exportName: `${id}-FunctionName`,
    });

    new cdk.CfnOutput(this, 'FunctionArn', {
      value: this.function.functionArn,
      description: 'Lambda function ARN',
      exportName: `${id}-FunctionArn`,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'HTTP API endpoint URL',
      exportName: `${id}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: configSecret.secretArn,
      description: 'Configuration secret ARN',
      exportName: `${id}-SecretArn`,
    });
  }
}
