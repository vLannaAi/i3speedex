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
    // Sales CRUD Lambda Functions (10)
    // ========================================

    // 1. List Sales
    const listSalesFunction = new nodejs.NodejsFunction(this, 'ListSalesFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleListSales-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/list-sales.ts'),
      handler: 'handler',
      description: 'List sales with pagination and filtering',
    });

    // 2. Get Sale
    const getSaleFunction = new nodejs.NodejsFunction(this, 'GetSaleFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGetSale-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/get-sale.ts'),
      handler: 'handler',
      description: 'Get single sale by ID',
    });

    // 3. Create Sale
    const createSaleFunction = new nodejs.NodejsFunction(this, 'CreateSaleFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleCreateSale-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/create-sale.ts'),
      handler: 'handler',
      description: 'Create new sale',
    });

    // 4. Update Sale
    const updateSaleFunction = new nodejs.NodejsFunction(this, 'UpdateSaleFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleUpdateSale-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/update-sale.ts'),
      handler: 'handler',
      description: 'Update sale details',
    });

    // 5. Delete Sale
    const deleteSaleFunction = new nodejs.NodejsFunction(this, 'DeleteSaleFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleDeleteSale-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/delete-sale.ts'),
      handler: 'handler',
      description: 'Soft delete sale',
    });

    // 6. Confirm Sale
    const confirmSaleFunction = new nodejs.NodejsFunction(this, 'ConfirmSaleFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleConfirmSale-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/confirm-sale.ts'),
      handler: 'handler',
      description: 'Confirm sale',
    });

    // 7. List Sale Lines
    const listSaleLinesFunction = new nodejs.NodejsFunction(this, 'ListSaleLinesFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleListSaleLines-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/list-sale-lines.ts'),
      handler: 'handler',
      description: 'List sale lines',
    });

    // 8. Create Sale Line
    const createSaleLineFunction = new nodejs.NodejsFunction(this, 'CreateSaleLineFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleCreateSaleLine-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/create-sale-line.ts'),
      handler: 'handler',
      description: 'Add line to sale',
    });

    // 9. Update Sale Line
    const updateSaleLineFunction = new nodejs.NodejsFunction(this, 'UpdateSaleLineFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleUpdateSaleLine-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/update-sale-line.ts'),
      handler: 'handler',
      description: 'Update sale line',
    });

    // 10. Delete Sale Line
    const deleteSaleLineFunction = new nodejs.NodejsFunction(this, 'DeleteSaleLineFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleDeleteSaleLine-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sales/delete-sale-line.ts'),
      handler: 'handler',
      description: 'Delete sale line',
    });

    // ========================================
    // Buyers CRUD Lambda Functions (5)
    // ========================================

    const listBuyersFunction = new nodejs.NodejsFunction(this, 'ListBuyersFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleListBuyers-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/buyers/list-buyers.ts'),
      handler: 'handler',
      description: 'List buyers',
    });

    const getBuyerFunction = new nodejs.NodejsFunction(this, 'GetBuyerFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGetBuyer-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/buyers/get-buyer.ts'),
      handler: 'handler',
      description: 'Get buyer by ID',
    });

    const createBuyerFunction = new nodejs.NodejsFunction(this, 'CreateBuyerFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleCreateBuyer-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/buyers/create-buyer.ts'),
      handler: 'handler',
      description: 'Create new buyer',
    });

    const updateBuyerFunction = new nodejs.NodejsFunction(this, 'UpdateBuyerFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleUpdateBuyer-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/buyers/update-buyer.ts'),
      handler: 'handler',
      description: 'Update buyer',
    });

    const deleteBuyerFunction = new nodejs.NodejsFunction(this, 'DeleteBuyerFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleDeleteBuyer-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/buyers/delete-buyer.ts'),
      handler: 'handler',
      description: 'Delete buyer',
    });

    // ========================================
    // Producers CRUD Lambda Functions (5)
    // ========================================

    const listProducersFunction = new nodejs.NodejsFunction(this, 'ListProducersFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleListProducers-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/producers/list-producers.ts'),
      handler: 'handler',
      description: 'List producers',
    });

    const getProducerFunction = new nodejs.NodejsFunction(this, 'GetProducerFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGetProducer-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/producers/get-producer.ts'),
      handler: 'handler',
      description: 'Get producer by ID',
    });

    const createProducerFunction = new nodejs.NodejsFunction(this, 'CreateProducerFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleCreateProducer-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/producers/create-producer.ts'),
      handler: 'handler',
      description: 'Create new producer',
    });

    const updateProducerFunction = new nodejs.NodejsFunction(this, 'UpdateProducerFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleUpdateProducer-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/producers/update-producer.ts'),
      handler: 'handler',
      description: 'Update producer',
    });

    const deleteProducerFunction = new nodejs.NodejsFunction(this, 'DeleteProducerFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleDeleteProducer-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/producers/delete-producer.ts'),
      handler: 'handler',
      description: 'Delete producer',
    });

    // ========================================
    // Invoice Generation Lambda Functions (4)
    // ========================================

    const generateHtmlInvoiceFunction = new nodejs.NodejsFunction(this, 'GenerateHtmlInvoiceFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGenerateHtmlInvoice-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/invoices/generate-html-invoice.ts'),
      handler: 'handler',
      description: 'Generate HTML invoice',
      timeout: cdk.Duration.seconds(60),
    });

    const generatePdfInvoiceFunction = new nodejs.NodejsFunction(this, 'GeneratePdfInvoiceFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGeneratePdfInvoice-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/invoices/generate-pdf-invoice.ts'),
      handler: 'handler',
      description: 'Generate PDF invoice',
      timeout: cdk.Duration.seconds(60),
    });

    const generateSdiInvoiceFunction = new nodejs.NodejsFunction(this, 'GenerateSdiInvoiceFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGenerateSdiInvoice-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/invoices/generate-sdi-invoice.ts'),
      handler: 'handler',
      description: 'Generate SDI XML invoice',
      timeout: cdk.Duration.seconds(60),
    });

    const getInvoiceDownloadUrlFunction = new nodejs.NodejsFunction(this, 'GetInvoiceDownloadUrlFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGetInvoiceDownloadUrl-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/invoices/get-invoice-download-url.ts'),
      handler: 'handler',
      description: 'Get invoice download URL',
    });

    // ========================================
    // Attachment Lambda Functions (4)
    // ========================================

    const generateUploadUrlFunction = new nodejs.NodejsFunction(this, 'GenerateUploadUrlFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGenerateUploadUrl-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/attachments/generate-upload-url.ts'),
      handler: 'handler',
      description: 'Generate upload URL',
    });

    const registerAttachmentFunction = new nodejs.NodejsFunction(this, 'RegisterAttachmentFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleRegisterAttachment-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/attachments/register-attachment.ts'),
      handler: 'handler',
      description: 'Register attachment',
    });

    const listAttachmentsFunction = new nodejs.NodejsFunction(this, 'ListAttachmentsFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleListAttachments-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/attachments/list-attachments.ts'),
      handler: 'handler',
      description: 'List attachments',
    });

    const deleteAttachmentFunction = new nodejs.NodejsFunction(this, 'DeleteAttachmentFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleDeleteAttachment-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/attachments/delete-attachment.ts'),
      handler: 'handler',
      description: 'Delete attachment',
    });

    // ========================================
    // Search Lambda Functions (3)
    // ========================================

    const searchSalesFunction = new nodejs.NodejsFunction(this, 'SearchSalesFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleSearchSales-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/search/search-sales.ts'),
      handler: 'handler',
      description: 'Search sales',
    });

    const searchBuyersFunction = new nodejs.NodejsFunction(this, 'SearchBuyersFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleSearchBuyers-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/search/search-buyers.ts'),
      handler: 'handler',
      description: 'Search buyers',
    });

    const searchProducersFunction = new nodejs.NodejsFunction(this, 'SearchProducersFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleSearchProducers-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/search/search-producers.ts'),
      handler: 'handler',
      description: 'Search producers',
    });

    // ========================================
    // Sync Lambda Functions (3)
    // ========================================

    const syncSalesFunction = new nodejs.NodejsFunction(this, 'SyncSalesFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleSyncSales-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sync/sync-sales.ts'),
      handler: 'handler',
      description: 'Sync sales (initial + delta)',
    });

    const syncBuyersFunction = new nodejs.NodejsFunction(this, 'SyncBuyersFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleSyncBuyers-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sync/sync-buyers.ts'),
      handler: 'handler',
      description: 'Sync buyers (initial + delta)',
    });

    const syncProducersFunction = new nodejs.NodejsFunction(this, 'SyncProducersFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleSyncProducers-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/sync/sync-producers.ts'),
      handler: 'handler',
      description: 'Sync producers (initial + delta)',
    });

    // ========================================
    // Dashboard Lambda Functions (4)
    // ========================================

    const getDashboardStatsFunction = new nodejs.NodejsFunction(this, 'GetDashboardStatsFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGetDashboardStats-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/dashboard/get-dashboard-stats.ts'),
      handler: 'handler',
      description: 'Get dashboard statistics',
    });

    const getSalesByDateRangeFunction = new nodejs.NodejsFunction(this, 'GetSalesByDateRangeFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGetSalesByDateRange-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/dashboard/get-sales-by-date-range.ts'),
      handler: 'handler',
      description: 'Get sales by date range',
    });

    const getTopBuyersFunction = new nodejs.NodejsFunction(this, 'GetTopBuyersFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGetTopBuyers-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/dashboard/get-top-buyers.ts'),
      handler: 'handler',
      description: 'Get top buyers',
    });

    const getRecentActivityFunction = new nodejs.NodejsFunction(this, 'GetRecentActivityFunction', {
      ...commonLambdaProps,
      functionName: `SaleModuleGetRecentActivity-${environment}`,
      entry: path.join(__dirname, '../../functions/sale-module-api/src/handlers/dashboard/get-recent-activity.ts'),
      handler: 'handler',
      description: 'Get recent activity',
    });

    // Store functions for easy access
    this.functions = {
      listSales: listSalesFunction,
      getSale: getSaleFunction,
      createSale: createSaleFunction,
      updateSale: updateSaleFunction,
      deleteSale: deleteSaleFunction,
      confirmSale: confirmSaleFunction,
      listSaleLines: listSaleLinesFunction,
      createSaleLine: createSaleLineFunction,
      updateSaleLine: updateSaleLineFunction,
      deleteSaleLine: deleteSaleLineFunction,
      listBuyers: listBuyersFunction,
      getBuyer: getBuyerFunction,
      createBuyer: createBuyerFunction,
      updateBuyer: updateBuyerFunction,
      deleteBuyer: deleteBuyerFunction,
      listProducers: listProducersFunction,
      getProducer: getProducerFunction,
      createProducer: createProducerFunction,
      updateProducer: updateProducerFunction,
      deleteProducer: deleteProducerFunction,
      generateHtmlInvoice: generateHtmlInvoiceFunction,
      generatePdfInvoice: generatePdfInvoiceFunction,
      generateSdiInvoice: generateSdiInvoiceFunction,
      getInvoiceDownloadUrl: getInvoiceDownloadUrlFunction,
      generateUploadUrl: generateUploadUrlFunction,
      registerAttachment: registerAttachmentFunction,
      listAttachments: listAttachmentsFunction,
      deleteAttachment: deleteAttachmentFunction,
      searchSales: searchSalesFunction,
      searchBuyers: searchBuyersFunction,
      searchProducers: searchProducersFunction,
      getDashboardStats: getDashboardStatsFunction,
      getSalesByDateRange: getSalesByDateRangeFunction,
      getTopBuyers: getTopBuyersFunction,
      getRecentActivity: getRecentActivityFunction,
      syncSales: syncSalesFunction,
      syncBuyers: syncBuyersFunction,
      syncProducers: syncProducersFunction,
    };

    // ========================================
    // Grant Permissions
    // ========================================

    // DynamoDB permissions for all functions
    Object.values(this.functions).forEach((func) => {
      // Sales table access
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

      // Buyers table access
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

      // Producers table access
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

      // S3 permissions
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

    // Lambda invoke permissions for invoice functions
    const invoiceFunctions = [
      generateHtmlInvoiceFunction,
      generatePdfInvoiceFunction,
      generateSdiInvoiceFunction,
    ];

    invoiceFunctions.forEach((func) => {
      func.addToRolePolicy(new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [
          `arn:aws:lambda:${this.region}:${this.account}:function:${props.templateRendererFunctionName}`,
          `arn:aws:lambda:${this.region}:${this.account}:function:${props.htmlToPdfFunctionName}`,
          `arn:aws:lambda:${this.region}:${this.account}:function:${props.sdiGeneratorFunctionName}`,
        ],
      }));
    });

    // ========================================
    // API Gateway Integrations (Part 1 of 2)
    // ========================================

    // Helper function to create route with integration
    const addRoute = (
      method: apigatewayv2.HttpMethod,
      path: string,
      func: lambda.Function,
      requireAuth = true
    ) => {
      const integration = new integrations.HttpLambdaIntegration(
        `${func.node.id}Integration`,
        func,
        { payloadFormatVersion: apigatewayv2.PayloadFormatVersion.VERSION_1_0 }
      );

      httpApi.addRoutes({
        path,
        methods: [method],
        integration,
        authorizer: requireAuth ? jwtAuthorizer : undefined,
      });
    };

    // Sales Routes
    addRoute(apigatewayv2.HttpMethod.GET, '/api/sales', listSalesFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/sales/{id}', getSaleFunction);
    addRoute(apigatewayv2.HttpMethod.POST, '/api/sales', createSaleFunction);
    addRoute(apigatewayv2.HttpMethod.PUT, '/api/sales/{id}', updateSaleFunction);
    addRoute(apigatewayv2.HttpMethod.DELETE, '/api/sales/{id}', deleteSaleFunction);
    addRoute(apigatewayv2.HttpMethod.POST, '/api/sales/{id}/confirm', confirmSaleFunction);

    // Sale Lines Routes
    addRoute(apigatewayv2.HttpMethod.GET, '/api/sales/{id}/lines', listSaleLinesFunction);
    addRoute(apigatewayv2.HttpMethod.POST, '/api/sales/{id}/lines', createSaleLineFunction);
    addRoute(apigatewayv2.HttpMethod.PUT, '/api/sales/{id}/lines/{lineId}', updateSaleLineFunction);
    addRoute(apigatewayv2.HttpMethod.DELETE, '/api/sales/{id}/lines/{lineId}', deleteSaleLineFunction);

    // Buyers Routes
    addRoute(apigatewayv2.HttpMethod.GET, '/api/buyers', listBuyersFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/buyers/{id}', getBuyerFunction);
    addRoute(apigatewayv2.HttpMethod.POST, '/api/buyers', createBuyerFunction);
    addRoute(apigatewayv2.HttpMethod.PUT, '/api/buyers/{id}', updateBuyerFunction);
    addRoute(apigatewayv2.HttpMethod.DELETE, '/api/buyers/{id}', deleteBuyerFunction);

    // Producers Routes
    addRoute(apigatewayv2.HttpMethod.GET, '/api/producers', listProducersFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/producers/{id}', getProducerFunction);
    addRoute(apigatewayv2.HttpMethod.POST, '/api/producers', createProducerFunction);
    addRoute(apigatewayv2.HttpMethod.PUT, '/api/producers/{id}', updateProducerFunction);
    addRoute(apigatewayv2.HttpMethod.DELETE, '/api/producers/{id}', deleteProducerFunction);

    // Invoice Routes
    addRoute(apigatewayv2.HttpMethod.POST, '/api/sales/{id}/invoice/html', generateHtmlInvoiceFunction);
    addRoute(apigatewayv2.HttpMethod.POST, '/api/sales/{id}/invoice/pdf', generatePdfInvoiceFunction);
    addRoute(apigatewayv2.HttpMethod.POST, '/api/sales/{id}/invoice/sdi', generateSdiInvoiceFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/sales/{id}/invoice/download', getInvoiceDownloadUrlFunction);

    // Attachment Routes
    addRoute(apigatewayv2.HttpMethod.POST, '/api/sales/{id}/upload-url', generateUploadUrlFunction);
    addRoute(apigatewayv2.HttpMethod.POST, '/api/sales/{id}/attachments', registerAttachmentFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/sales/{id}/attachments', listAttachmentsFunction);
    addRoute(apigatewayv2.HttpMethod.DELETE, '/api/sales/{id}/attachments/{attachmentId}', deleteAttachmentFunction);

    // Search Routes
    addRoute(apigatewayv2.HttpMethod.GET, '/api/search/sales', searchSalesFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/search/buyers', searchBuyersFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/search/producers', searchProducersFunction);

    // Sync Routes
    addRoute(apigatewayv2.HttpMethod.GET, '/api/sync/sales', syncSalesFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/sync/buyers', syncBuyersFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/sync/producers', syncProducersFunction);

    // Dashboard Routes
    addRoute(apigatewayv2.HttpMethod.GET, '/api/dashboard/stats', getDashboardStatsFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/dashboard/sales-by-date', getSalesByDateRangeFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/dashboard/top-buyers', getTopBuyersFunction);
    addRoute(apigatewayv2.HttpMethod.GET, '/api/dashboard/recent-activity', getRecentActivityFunction);

    // ========================================
    // Tags
    // ========================================
    cdk.Tags.of(this).add('Project', 'i2speedex-sale-module');
    cdk.Tags.of(this).add('Component', 'lambda-functions');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
