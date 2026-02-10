import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import * as path from 'path';

export interface SdiInvoiceGeneratorStackProps extends cdk.StackProps {
  environment: 'dev' | 'prod';
  alertEmail?: string;
}

export class SdiInvoiceGeneratorStack extends cdk.Stack {
  public readonly functionUrl: string;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: SdiInvoiceGeneratorStackProps) {
    super(scope, id, props);

    const { environment, alertEmail } = props;

    // S3 Bucket for storing generated SDI XML invoices
    this.bucket = new s3.Bucket(this, 'SdiInvoiceBucket', {
      bucketName: `sdi-invoice-generator-${environment}-${this.account}`,
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: environment === 'dev',
      versioned: environment === 'prod',
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldInvoices',
          enabled: environment === 'dev',
          expiration: cdk.Duration.days(30), // Delete dev invoices after 30 days
        },
        {
          id: 'TransitionToIA',
          enabled: environment === 'prod',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90), // Move to IA after 90 days
            },
          ],
        },
      ],
    });

    // Lambda Function
    const functionName = `sdi-invoice-generator-${environment}`;

    const sdiFunction = new lambda.Function(this, 'SdiInvoiceGeneratorFunction', {
      functionName,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions/sdi-invoice-generator/lambda-deploy')),
      memorySize: 1024, // SDI generation is less intensive than PDF, 1GB should suffice
      timeout: cdk.Duration.seconds(30),
      environment: {
        S3_BUCKET: this.bucket.bucketName,
        NODE_ENV: environment === 'prod' ? 'production' : 'development',
      },
      reservedConcurrentExecutions: environment === 'dev' ? 5 : 20,
      logRetention: environment === 'dev'
        ? logs.RetentionDays.ONE_WEEK
        : logs.RetentionDays.ONE_MONTH,
    });

    // Grant S3 permissions
    this.bucket.grantReadWrite(sdiFunction);

    // Function URL with CORS
    const fnUrl = sdiFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['Content-Type'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    this.functionUrl = fnUrl.url;

    // CloudWatch Alarms
    if (alertEmail) {
      // SNS Topic for alarms
      const alarmTopic = new sns.Topic(this, 'SdiAlarmTopic', {
        displayName: `SDI Invoice Generator ${environment} Alarms`,
      });

      alarmTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));

      // Error Alarm
      const errorAlarm = new cloudwatch.Alarm(this, 'SdiErrorAlarm', {
        alarmName: `${functionName}-errors`,
        alarmDescription: 'Alert when SDI invoice generation error rate exceeds 1%',
        metric: sdiFunction.metricErrors({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

      // Duration Alarm
      const durationAlarm = new cloudwatch.Alarm(this, 'SdiDurationAlarm', {
        alarmName: `${functionName}-duration`,
        alarmDescription: 'Alert when SDI generation duration exceeds 20 seconds',
        metric: sdiFunction.metricDuration({
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 20000, // 20 seconds in milliseconds
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      durationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

      // Throttle Alarm
      const throttleAlarm = new cloudwatch.Alarm(this, 'SdiThrottleAlarm', {
        alarmName: `${functionName}-throttles`,
        alarmDescription: 'Alert when SDI generation is throttled',
        metric: sdiFunction.metricThrottles({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      throttleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));
    }

    // Outputs
    new cdk.CfnOutput(this, 'FunctionUrl', {
      value: this.functionUrl,
      description: 'SDI Invoice Generator Function URL',
      exportName: `SdiInvoiceGeneratorUrl-${environment}`,
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 Bucket for SDI invoices',
      exportName: `SdiInvoiceBucket-${environment}`,
    });

    new cdk.CfnOutput(this, 'FunctionName', {
      value: sdiFunction.functionName,
      description: 'Lambda Function Name',
      exportName: `SdiInvoiceFunctionName-${environment}`,
    });

    new cdk.CfnOutput(this, 'FunctionArn', {
      value: sdiFunction.functionArn,
      description: 'Lambda Function ARN',
      exportName: `SdiInvoiceFunctionArn-${environment}`,
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'i2speedex-lambda-building-blocks');
    cdk.Tags.of(this).add('Component', 'sdi-invoice-generator');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
