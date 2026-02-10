#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { HtmlToPdfStack } from '../lib/html-to-pdf-stack';
import { SdiInvoiceGeneratorStack } from '../lib/sdi-invoice-generator-stack';
import { TemplateRendererStack } from '../lib/template-renderer-stack';
import { SaleModuleDynamoDBStack } from '../lib/sale-module-dynamodb-stack';
import { SaleModuleCognitoStack } from '../lib/sale-module-cognito-stack';
import { SaleModuleApiGatewayStack } from '../lib/sale-module-api-gateway-stack';
import { SaleModuleS3Stack } from '../lib/sale-module-s3-stack';
import { SaleModuleLambdaStack } from '../lib/sale-module-lambda-stack';
import { EmailReconcilerStack } from '../lib/email-reconciler-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';

// Environment-specific configuration for HTML to PDF
const htmlToPdfConfig = {
  dev: {
    stackName: 'HtmlToPdfLambda-Dev',
    reservedConcurrency: 5,
    memorySize: 2048,
    timeout: 30,
    enableXRay: false,
    logRetention: 7, // days
  },
  prod: {
    stackName: 'HtmlToPdfLambda-Prod',
    reservedConcurrency: 10,
    memorySize: 2048,
    timeout: 30,
    enableXRay: true,
    logRetention: 30, // days
  }
};

const htmlConfig = htmlToPdfConfig[environment as keyof typeof htmlToPdfConfig] || htmlToPdfConfig.dev;

// HTML to PDF Stack
new HtmlToPdfStack(app, htmlConfig.stackName, {
  environment,
  ...htmlConfig,
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: `HTML to PDF Lambda Function - ${environment}`,
  tags: {
    Environment: environment,
    Project: 'lambda-building-blocks',
    Service: 'html-to-pdf',
    ManagedBy: 'CDK'
  }
});

// SDI Invoice Generator Stack
new SdiInvoiceGeneratorStack(app, `SdiInvoiceGeneratorLambda-${environment === 'dev' ? 'Dev' : 'Prod'}`, {
  environment: environment as 'dev' | 'prod',
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: `SDI Invoice Generator Lambda Function - ${environment}`,
  tags: {
    Environment: environment,
    Project: 'lambda-building-blocks',
    Service: 'sdi-invoice-generator',
    ManagedBy: 'CDK'
  }
});

// Template Renderer Stack
new TemplateRendererStack(app, `TemplateRendererLambda-${environment === 'dev' ? 'Dev' : 'Prod'}`, {
  environment: environment as 'dev' | 'prod',
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: `Template Renderer Lambda Function - ${environment}`,
  tags: {
    Environment: environment,
    Project: 'lambda-building-blocks',
    Service: 'template-renderer',
    ManagedBy: 'CDK'
  }
});

// Sale Module DynamoDB Tables Stack
const dynamoDBStack = new SaleModuleDynamoDBStack(app, `SaleModuleDynamoDB-${environment === 'dev' ? 'Dev' : environment === 'staging' ? 'Staging' : 'Prod'}`, {
  environment: environment as 'dev' | 'staging' | 'prod',
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: `i2speedex Sale Module DynamoDB Tables - ${environment}`,
  tags: {
    Environment: environment,
    Project: 'i2speedex-sale-module',
    Service: 'dynamodb',
    ManagedBy: 'CDK'
  }
});

// Sale Module Cognito Authentication Stack
const cognitoStack = new SaleModuleCognitoStack(app, `SaleModuleCognito-${environment === 'dev' ? 'Dev' : environment === 'staging' ? 'Staging' : 'Prod'}`, {
  environment: environment as 'dev' | 'staging' | 'prod',
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: `i2speedex Sale Module Cognito Authentication - ${environment}`,
  tags: {
    Environment: environment,
    Project: 'i2speedex-sale-module',
    Service: 'cognito',
    ManagedBy: 'CDK'
  }
});

// Sale Module API Gateway Stack
const apiGatewayStack = new SaleModuleApiGatewayStack(app, `SaleModuleApiGateway-${environment === 'dev' ? 'Dev' : environment === 'staging' ? 'Staging' : 'Prod'}`, {
  environment: environment as 'dev' | 'staging' | 'prod',
  userPoolId: cognitoStack.userPool.userPoolId,
  userPoolClientId: cognitoStack.userPoolClient.userPoolClientId,
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: `i2speedex Sale Module API Gateway - ${environment}`,
  tags: {
    Environment: environment,
    Project: 'i2speedex-sale-module',
    Service: 'api-gateway',
    ManagedBy: 'CDK'
  }
});

// Sale Module S3 Buckets Stack
const s3Stack = new SaleModuleS3Stack(app, `SaleModuleS3-${environment === 'dev' ? 'Dev' : environment === 'staging' ? 'Staging' : 'Prod'}`, {
  environment: environment as 'dev' | 'staging' | 'prod',
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: `i2speedex Sale Module S3 Buckets - ${environment}`,
  tags: {
    Environment: environment,
    Project: 'i2speedex-sale-module',
    Service: 's3-storage',
    ManagedBy: 'CDK'
  }
});

// Sale Module Lambda Functions Stack
new SaleModuleLambdaStack(app, `SaleModuleLambda-${environment === 'dev' ? 'Dev' : environment === 'staging' ? 'Staging' : 'Prod'}`, {
  environment: environment as 'dev' | 'staging' | 'prod',
  httpApi: apiGatewayStack.httpApi,
  jwtIssuer: `https://cognito-idp.${process.env.CDK_DEFAULT_REGION || 'eu-west-1'}.amazonaws.com/${cognitoStack.userPool.userPoolId}`,
  jwtAudience: [cognitoStack.userPoolClient.userPoolClientId],
  salesTableName: dynamoDBStack.salesTable.tableName,
  buyersTableName: dynamoDBStack.buyersTable.tableName,
  producersTableName: dynamoDBStack.producersTable.tableName,
  documentsBucketName: s3Stack.documentsBucket.bucketName,
  templateRendererFunctionName: `TemplateRendererLambda-${environment === 'dev' ? 'Dev' : 'Prod'}`,
  htmlToPdfFunctionName: `HtmlToPdfLambda-${environment === 'dev' ? 'Dev' : 'Prod'}`,
  sdiGeneratorFunctionName: `SdiInvoiceGeneratorLambda-${environment === 'dev' ? 'Dev' : 'Prod'}`,
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: `i2speedex Sale Module Lambda Functions - ${environment}`,
  tags: {
    Environment: environment,
    Project: 'i2speedex-sale-module',
    Service: 'lambda-functions',
    ManagedBy: 'CDK'
  }
});

// Email Reconciler Stack
new EmailReconcilerStack(app, `EmailReconciler-${environment === 'dev' ? 'Dev' : environment === 'staging' ? 'Staging' : 'Prod'}`, {
  environment: environment as 'dev' | 'staging' | 'prod',
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: `Email Reconciler Lambda Function - ${environment}`,
  tags: {
    Environment: environment,
    Project: 'i2speedex-email-reconciler',
    Service: 'email-reconciler',
    ManagedBy: 'CDK'
  }
});

app.synth();
