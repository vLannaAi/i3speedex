import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface SaleModuleApiGatewayStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
  userPoolId: string;
  userPoolClientId: string;
}

export class SaleModuleApiGatewayStack extends cdk.Stack {
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly apiUrl: string;
  public readonly authorizer: apigatewayv2.HttpAuthorizer;

  constructor(scope: Construct, id: string, props: SaleModuleApiGatewayStackProps) {
    super(scope, id, props);

    const { environment, userPoolId, userPoolClientId } = props;
    const isProd = environment === 'prod';

    // Import existing User Pool
    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      'ImportedUserPool',
      userPoolId
    );

    // ========================================
    // CloudWatch Log Group for API Gateway
    // ========================================
    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: `/aws/apigateway/i2speedex-sale-api-${environment}`,
      retention: isProd ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // HTTP API Gateway (v2)
    // ========================================
    this.httpApi = new apigatewayv2.HttpApi(this, 'SaleModuleHttpApi', {
      apiName: `i2speedex-sale-api-${environment}`,
      description: `i2speedex Sale Module API - ${environment}`,

      // CORS Configuration
      corsPreflight: {
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: environment === 'prod'
          ? ['https://sales.i2speedex.com']
          : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', `https://${environment}-sales.i2speedex.com`],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(1),
      },

      // Default settings
      createDefaultStage: true,
      disableExecuteApiEndpoint: false, // Keep default endpoint for now
    });

    // Configure default stage with throttling
    const defaultStage = this.httpApi.defaultStage as apigatewayv2.HttpStage;

    // Add throttling to default stage using CfnStage
    const cfnStage = defaultStage.node.defaultChild as apigatewayv2.CfnStage;
    cfnStage.defaultRouteSettings = {
      throttlingBurstLimit: isProd ? 200 : 100,
      throttlingRateLimit: isProd ? 100 : 50,
    };

    // Add access logging
    cfnStage.accessLogSettings = {
      destinationArn: apiLogGroup.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        ip: '$context.identity.sourceIp',
        requestTime: '$context.requestTime',
        httpMethod: '$context.httpMethod',
        routeKey: '$context.routeKey',
        status: '$context.status',
        protocol: '$context.protocol',
        responseLength: '$context.responseLength',
        errorMessage: '$context.error.message',
        integrationErrorMessage: '$context.integrationErrorMessage',
      }),
    };

    // Add dependency
    defaultStage.node.addDependency(apiLogGroup);

    // ========================================
    // JWT Authorizer (Cognito)
    // ========================================
    this.authorizer = new apigatewayv2.HttpAuthorizer(this, 'CognitoAuthorizer', {
      httpApi: this.httpApi,
      identitySource: ['$request.header.Authorization'],
      type: apigatewayv2.HttpAuthorizerType.JWT,
      jwtAudience: [userPoolClientId],
      jwtIssuer: `https://cognito-idp.${this.region}.amazonaws.com/${userPoolId}`,
      authorizerName: `cognito-authorizer-${environment}`,
    });

    // ========================================
    // API Routes Structure (Placeholders)
    // ========================================

    // Note: These routes will be connected to Lambda integrations later
    // For now, we're just defining the route structure

    /*
    // Sales Routes
    GET    /api/sales              - List all sales (with pagination)
    GET    /api/sales/{id}         - Get sale details
    POST   /api/sales              - Create new sale
    PUT    /api/sales/{id}         - Update sale
    DELETE /api/sales/{id}         - Delete sale
    GET    /api/sales/{id}/lines   - Get sale lines
    POST   /api/sales/{id}/lines   - Add line to sale
    PUT    /api/sales/{id}/lines/{lineId} - Update line
    DELETE /api/sales/{id}/lines/{lineId} - Delete line
    POST   /api/sales/{id}/invoice - Generate invoice (PDF/XML)

    // Buyers Routes
    GET    /api/buyers             - List all buyers
    GET    /api/buyers/{id}        - Get buyer details
    POST   /api/buyers             - Create new buyer
    PUT    /api/buyers/{id}        - Update buyer
    DELETE /api/buyers/{id}        - Delete buyer

    // Producers Routes
    GET    /api/producers          - List all producers
    GET    /api/producers/{id}     - Get producer details
    POST   /api/producers          - Create new producer
    PUT    /api/producers/{id}     - Update producer
    DELETE /api/producers/{id}     - Delete producer

    // Dashboard Routes
    GET    /api/dashboard/stats    - Get dashboard statistics
    GET    /api/dashboard/recent   - Get recent sales

    // Search Routes
    GET    /api/search             - Global search
    */

    // Store API URL for outputs
    this.apiUrl = this.httpApi.apiEndpoint;

    // ========================================
    // CloudWatch Alarms (Production)
    // ========================================
    if (isProd) {
      // 4xx Error Alarm
      const clientErrorMetric = this.httpApi.metricClientError({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      new cdk.aws_cloudwatch.Alarm(this, 'ApiClientErrorsAlarm', {
        alarmName: `${this.httpApi.apiId}-client-errors`,
        alarmDescription: 'Alert when API client error rate is high',
        metric: clientErrorMetric,
        threshold: 10,
        evaluationPeriods: 2,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // 5xx Error Alarm
      const serverErrorMetric = this.httpApi.metricServerError({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      new cdk.aws_cloudwatch.Alarm(this, 'ApiServerErrorsAlarm', {
        alarmName: `${this.httpApi.apiId}-server-errors`,
        alarmDescription: 'Alert when API server error rate is high',
        metric: serverErrorMetric,
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Latency Alarm
      const latencyMetric = this.httpApi.metricLatency({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      });

      new cdk.aws_cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
        alarmName: `${this.httpApi.apiId}-latency`,
        alarmDescription: 'Alert when API latency is high',
        metric: latencyMetric,
        threshold: 1000, // 1 second
        evaluationPeriods: 3,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'ApiId', {
      value: this.httpApi.apiId,
      description: 'HTTP API Gateway ID',
      exportName: `ApiGatewayId-${environment}`,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'HTTP API Gateway URL',
      exportName: `ApiGatewayUrl-${environment}`,
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: `${this.apiUrl}/api`,
      description: 'API Base Endpoint',
      exportName: `ApiEndpoint-${environment}`,
    });

    new cdk.CfnOutput(this, 'AuthorizerId', {
      value: this.authorizer.authorizerId,
      description: 'Cognito JWT Authorizer ID',
      exportName: `AuthorizerId-${environment}`,
    });

    // ========================================
    // Tags
    // ========================================
    cdk.Tags.of(this).add('Project', 'i2speedex-sale-module');
    cdk.Tags.of(this).add('Component', 'api-gateway');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
