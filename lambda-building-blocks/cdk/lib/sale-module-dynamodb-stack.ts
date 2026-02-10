import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface SaleModuleDynamoDBStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
}

export class SaleModuleDynamoDBStack extends cdk.Stack {
  public readonly salesTable: dynamodb.Table;
  public readonly saleLinesTable: dynamodb.Table;
  public readonly buyersTable: dynamodb.Table;
  public readonly producersTable: dynamodb.Table;
  public readonly usersTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: SaleModuleDynamoDBStackProps) {
    super(scope, id, props);

    const { environment } = props;
    const isProd = environment === 'prod';

    // ========================================
    // Table 1: Sales
    // ========================================
    this.salesTable = new dynamodb.Table(this, 'SalesTable', {
      tableName: `i2speedex-sales-${environment}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
      pointInTimeRecovery: isProd, // Enable for production
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      deletionProtection: isProd,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // For triggers and replication
      timeToLiveAttribute: 'ttl', // Optional: for auto-expiring data
    });

    // GSI1: Query by Buyer
    this.salesTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-QueryByBuyer',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Query by Producer
    this.salesTable.addGlobalSecondaryIndex({
      indexName: 'GSI2-QueryByProducer',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI3: Query by Status
    this.salesTable.addGlobalSecondaryIndex({
      indexName: 'GSI3-QueryByStatus',
      partitionKey: {
        name: 'GSI3PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI3SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI4: Query by Year/Date (Optional)
    this.salesTable.addGlobalSecondaryIndex({
      indexName: 'GSI4-QueryByDate',
      partitionKey: {
        name: 'GSI4PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI4SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================
    // Table 2: SaleLines
    // ========================================
    this.saleLinesTable = new dynamodb.Table(this, 'SaleLinesTable', {
      tableName: `i2speedex-sale-lines-${environment}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: isProd,
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      deletionProtection: isProd,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // ========================================
    // Table 3: Buyers
    // ========================================
    this.buyersTable = new dynamodb.Table(this, 'BuyersTable', {
      tableName: `i2speedex-buyers-${environment}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: isProd,
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      deletionProtection: isProd,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI1: Query by Code (unique lookup)
    this.buyersTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-QueryByCode',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Query by Status
    this.buyersTable.addGlobalSecondaryIndex({
      indexName: 'GSI2-QueryByStatus',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================
    // Table 4: Producers
    // ========================================
    this.producersTable = new dynamodb.Table(this, 'ProducersTable', {
      tableName: `i2speedex-producers-${environment}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: isProd,
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      deletionProtection: isProd,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI1: Query by Code (unique lookup)
    this.producersTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-QueryByCode',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Query by Status
    this.producersTable.addGlobalSecondaryIndex({
      indexName: 'GSI2-QueryByStatus',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================
    // Table 5: Users (Cognito sync)
    // ========================================
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `i2speedex-users-${environment}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: isProd,
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      deletionProtection: isProd,
    });

    // GSI1: Query by Email
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-QueryByEmail',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================
    // CloudWatch Alarms
    // ========================================
    if (isProd) {
      // User Errors alarm for Sales table
      const salesUserErrorsMetric = this.salesTable.metricUserErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      new cdk.aws_cloudwatch.Alarm(this, 'SalesTableUserErrorsAlarm', {
        alarmName: `${this.salesTable.tableName}-user-errors`,
        metric: salesUserErrorsMetric,
        threshold: 10,
        evaluationPeriods: 2,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Throttled requests alarm for Sales table
      const salesThrottleMetric = this.salesTable.metric('UserThrottleRequests', {
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      new cdk.aws_cloudwatch.Alarm(this, 'SalesTableThrottleAlarm', {
        alarmName: `${this.salesTable.tableName}-throttles`,
        metric: salesThrottleMetric,
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'SalesTableName', {
      value: this.salesTable.tableName,
      description: 'Sales DynamoDB Table Name',
      exportName: `SalesTableName-${environment}`,
    });

    new cdk.CfnOutput(this, 'SalesTableArn', {
      value: this.salesTable.tableArn,
      description: 'Sales DynamoDB Table ARN',
      exportName: `SalesTableArn-${environment}`,
    });

    new cdk.CfnOutput(this, 'SaleLinesTableName', {
      value: this.saleLinesTable.tableName,
      description: 'Sale Lines DynamoDB Table Name',
      exportName: `SaleLinesTableName-${environment}`,
    });

    new cdk.CfnOutput(this, 'BuyersTableName', {
      value: this.buyersTable.tableName,
      description: 'Buyers DynamoDB Table Name',
      exportName: `BuyersTableName-${environment}`,
    });

    new cdk.CfnOutput(this, 'ProducersTableName', {
      value: this.producersTable.tableName,
      description: 'Producers DynamoDB Table Name',
      exportName: `ProducersTableName-${environment}`,
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'Users DynamoDB Table Name',
      exportName: `UsersTableName-${environment}`,
    });

    // ========================================
    // Tags
    // ========================================
    cdk.Tags.of(this).add('Project', 'i2speedex-sale-module');
    cdk.Tags.of(this).add('Component', 'dynamodb-tables');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
