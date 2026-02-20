import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface SaleModuleLambdaStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
  httpApi: apigatewayv2.HttpApi;
  jwtIssuer: string;
  jwtAudience: string[];
  salesTableName: string;
  buyersTableName: string;
  producersTableName: string;
  documentsBucketName: string;
  templateRendererFunctionName: string;
  htmlToPdfFunctionName: string;
  sdiGeneratorFunctionName: string;
}

export class SaleModuleLambdaStack extends cdk.Stack {
  public readonly functions: { [key: string]: lambda.Function } = {};

  constructor(scope: Construct, id: string, props: SaleModuleLambdaStackProps) {
    super(scope, id, props);

    const { environment, httpApi, jwtIssuer, jwtAudience, salesTableName, buyersTableName, producersTableName, documentsBucketName } = props;
    const isProd = environment === 'prod';

    // Create JWT Authorizer
    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'JwtAuthorizer',
      jwtIssuer,
      {
        jwtAudience,
      }
    );

    // ========================================
    // Common Lambda Configuration
    // ========================================
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: isProd ? 512 : 256,
      architecture: lambda.Architecture.ARM_64,
      logRetention: isProd ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      environment: {
        NODE_ENV: environment,
        SALES_TABLE_NAME: salesTableName,
        BUYERS_TABLE_NAME: buyersTableName,
        PRODUCERS_TABLE_NAME: producersTableName,
        DOCUMENTS_BUCKET_NAME: documentsBucketName,
        TEMPLATE_RENDERER_FUNCTION_NAME: props.templateRendererFunctionName,
        HTML_TO_PDF_FUNCTION_NAME: props.htmlToPdfFunctionName,
        SDI_GENERATOR_FUNCTION_NAME: props.sdiGeneratorFunctionName,
      },
      bundling: {
        minify: isProd,
        sourceMap: !isProd,
        target: 'es2020',
        externalModules: ['aws-sdk'],
      },
    };

    // ========================================
    // 12 Consolidated Lambda Functions
    // ========================================

    const buyersFunction = new nodejs.NodejsFunction(this, 'BuyersFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleBuyers-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/buyers/buyers.ts'),
      handler: 'handler',
      description: 'Buyers CRUD (list, get, create, update, delete)',
    });

    const producersFunction = new nodejs.NodejsFunction(this, 'ProducersFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleProducers-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/producers/producers.ts'),
      handler: 'handler',
      description: 'Producers CRUD (list, get, create, update, delete)',
    });

    const salesCrudFunction = new nodejs.NodejsFunction(this, 'SalesCrudFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleSalesCrud-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/sales-crud.ts'),
      handler: 'handler',
      description: 'Sales CRUD (list, get, create, update, delete)',
    });

    const saleLinesFunction = new nodejs.NodejsFunction(this, 'SaleLinesFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleSaleLines-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/sale-lines.ts'),
      handler: 'handler',
      description: 'Sale lines CRUD (list, create, update, delete)',
    });

    const confirmSaleFunction = new nodejs.NodejsFunction(this, 'ConfirmSaleFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleConfirmSale-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/confirm-sale.ts'),
      handler: 'handler',
      description: 'Confirm sale',
    });

    const invoiceFunction = new nodejs.NodejsFunction(this, 'InvoiceFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleInvoice-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/invoices/invoices.ts'),
      handler: 'handler',
      description: 'Invoice generation (html, pdf, sdi, download)',
      timeout: cdk.Duration.seconds(60),
    });

    const attachmentUploadFunction = new nodejs.NodejsFunction(this, 'AttachmentUploadFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleAttachmentUpload-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/attachments/generate-upload-url.ts'),
      handler: 'handler',
      description: 'Generate S3 presigned upload URL',
    });

    const attachmentCrudFunction = new nodejs.NodejsFunction(this, 'AttachmentCrudFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleAttachmentCrud-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/attachments/attachments.ts'),
      handler: 'handler',
      description: 'Attachment CRUD (register, list, delete)',
    });

    const searchFunction = new nodejs.NodejsFunction(this, 'SearchFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleSearch-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/search/search.ts'),
      handler: 'handler',
      description: 'Search sales, buyers, and producers',
    });

    const syncSalesFunction = new nodejs.NodejsFunction(this, 'SyncSalesFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleSyncSales-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sync/sync-sales.ts'),
      handler: 'handler',
      description: 'Sync sales (initial + delta)',
    });

    const syncEntitiesFunction = new nodejs.NodejsFunction(this, 'SyncEntitiesFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleSyncEntities-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sync/sync-entities.ts'),
      handler: 'handler',
      description: 'Sync buyers and producers (initial + delta)',
    });

    const dashboardFunction = new nodejs.NodejsFunction(this, 'DashboardFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleDashboard-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/dashboard/dashboard.ts'),
      handler: 'handler',
      description: 'Dashboard stats, sales by date, top buyers, recent activity',
    });

    // Store functions for easy access
    this.functions = {
      buyers: buyersFunction,
      producers: producersFunction,
      salesCrud: salesCrudFunction,
      saleLines: saleLinesFunction,
      confirmSale: confirmSaleFunction,
      invoice: invoiceFunction,
      attachmentUpload: attachmentUploadFunction,
      attachmentCrud: attachmentCrudFunction,
      search: searchFunction,
      syncSales: syncSalesFunction,
      syncEntities: syncEntitiesFunction,
      dashboard: dashboardFunction,
    };

    // ========================================
    // Grant Permissions
    // ========================================

    // DynamoDB and S3 permissions for all functions
    Object.values(this.functions).forEach((func) => {
      func.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${salesTableName}`,
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${salesTableName}/index/*`,
        ],
      }));

      func.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${buyersTableName}`,
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${buyersTableName}/index/*`,
        ],
      }));

      func.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${producersTableName}`,
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${producersTableName}/index/*`,
        ],
      }));

      func.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:DeleteObject',
          's3:ListBucket',
        ],
        resources: [
          `arn:aws:s3:::${documentsBucketName}`,
          `arn:aws:s3:::${documentsBucketName}/*`,
        ],
      }));
    });

    // Lambda invoke permissions for the consolidated invoice function
    invoiceFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [
        `arn:aws:lambda:${this.region}:${this.account}:function:${props.templateRendererFunctionName}`,
        `arn:aws:lambda:${this.region}:${this.account}:function:${props.htmlToPdfFunctionName}`,
        `arn:aws:lambda:${this.region}:${this.account}:function:${props.sdiGeneratorFunctionName}`,
      ],
    }));

    // ========================================
    // API Gateway Routes
    // ========================================

    const mkInt = (id: string, fn: lambda.Function) =>
      new integrations.HttpLambdaIntegration(id, fn,
        { payloadFormatVersion: apigatewayv2.PayloadFormatVersion.VERSION_1_0 });

    const buyersInt         = mkInt('BuyersIntegration', buyersFunction);
    const producersInt      = mkInt('ProducersIntegration', producersFunction);
    const salesCrudInt      = mkInt('SalesCrudIntegration', salesCrudFunction);
    const saleLinesInt      = mkInt('SaleLinesIntegration', saleLinesFunction);
    const confirmSaleInt    = mkInt('ConfirmSaleIntegration', confirmSaleFunction);
    const invoiceInt        = mkInt('InvoiceIntegration', invoiceFunction);
    const attachUploadInt   = mkInt('AttachmentUploadIntegration', attachmentUploadFunction);
    const attachCrudInt     = mkInt('AttachmentCrudIntegration', attachmentCrudFunction);
    const searchInt         = mkInt('SearchIntegration', searchFunction);
    const syncSalesInt      = mkInt('SyncSalesIntegration', syncSalesFunction);
    const syncEntitiesInt   = mkInt('SyncEntitiesIntegration', syncEntitiesFunction);
    const dashboardInt      = mkInt('DashboardIntegration', dashboardFunction);

    const addRoute = (
      method: apigatewayv2.HttpMethod,
      routePath: string,
      integration: integrations.HttpLambdaIntegration,
      requireAuth = true
    ) => {
      httpApi.addRoutes({
        path: routePath,
        methods: [method],
        integration,
        authorizer: requireAuth ? jwtAuthorizer : undefined,
      });
    };

    const { GET, POST, PUT, DELETE } = apigatewayv2.HttpMethod;

    // Sales CRUD Routes
    addRoute(GET,    '/api/sales',      salesCrudInt);
    addRoute(GET,    '/api/sales/{id}', salesCrudInt);
    addRoute(POST,   '/api/sales',      salesCrudInt);
    addRoute(PUT,    '/api/sales/{id}', salesCrudInt);
    addRoute(DELETE, '/api/sales/{id}', salesCrudInt);

    // Confirm Sale Route
    addRoute(POST, '/api/sales/{id}/confirm', confirmSaleInt);

    // Sale Lines Routes
    addRoute(GET,    '/api/sales/{id}/lines',              saleLinesInt);
    addRoute(POST,   '/api/sales/{id}/lines',              saleLinesInt);
    addRoute(PUT,    '/api/sales/{id}/lines/{lineId}',     saleLinesInt);
    addRoute(DELETE, '/api/sales/{id}/lines/{lineId}',     saleLinesInt);

    // Buyers Routes
    addRoute(GET,    '/api/buyers',      buyersInt);
    addRoute(GET,    '/api/buyers/{id}', buyersInt);
    addRoute(POST,   '/api/buyers',      buyersInt);
    addRoute(PUT,    '/api/buyers/{id}', buyersInt);
    addRoute(DELETE, '/api/buyers/{id}', buyersInt);

    // Producers Routes
    addRoute(GET,    '/api/producers',      producersInt);
    addRoute(GET,    '/api/producers/{id}', producersInt);
    addRoute(POST,   '/api/producers',      producersInt);
    addRoute(PUT,    '/api/producers/{id}', producersInt);
    addRoute(DELETE, '/api/producers/{id}', producersInt);

    // Invoice Routes
    addRoute(POST, '/api/sales/{id}/invoice/html',     invoiceInt);
    addRoute(POST, '/api/sales/{id}/invoice/pdf',      invoiceInt);
    addRoute(POST, '/api/sales/{id}/invoice/sdi',      invoiceInt);
    addRoute(GET,  '/api/sales/{id}/invoice/download', invoiceInt);

    // Attachment Routes
    addRoute(POST,   '/api/sales/{id}/upload-url',                    attachUploadInt);
    addRoute(POST,   '/api/sales/{id}/attachments',                   attachCrudInt);
    addRoute(GET,    '/api/sales/{id}/attachments',                   attachCrudInt);
    addRoute(DELETE, '/api/sales/{id}/attachments/{attachmentId}',    attachCrudInt);

    // Search Routes
    addRoute(GET, '/api/search/sales',     searchInt);
    addRoute(GET, '/api/search/buyers',    searchInt);
    addRoute(GET, '/api/search/producers', searchInt);

    // Sync Routes
    addRoute(GET, '/api/sync/sales',     syncSalesInt);
    addRoute(GET, '/api/sync/buyers',    syncEntitiesInt);
    addRoute(GET, '/api/sync/producers', syncEntitiesInt);

    // Dashboard Routes
    addRoute(GET, '/api/dashboard/stats',           dashboardInt);
    addRoute(GET, '/api/dashboard/sales-by-date',   dashboardInt);
    addRoute(GET, '/api/dashboard/top-buyers',      dashboardInt);
    addRoute(GET, '/api/dashboard/recent-activity', dashboardInt);

    // ========================================
    // Tags
    // ========================================
    cdk.Tags.of(this).add('Project', 'i2speedex-sale-module');
    cdk.Tags.of(this).add('Component', 'lambda-functions');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
