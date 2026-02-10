import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import * as path from 'path';

export interface HtmlToPdfStackProps extends cdk.StackProps {
  environment: string;
  reservedConcurrency: number;
  memorySize: number;
  timeout: number;
  enableXRay: boolean;
  logRetention: number;
}

export class HtmlToPdfStack extends cdk.Stack {
  public readonly function: lambda.Function;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: HtmlToPdfStackProps) {
    super(scope, id, props);

    // Create S3 bucket for storing generated PDFs
    this.bucket = new s3.Bucket(this, 'PdfBucket', {
      bucketName: `html-to-pdf-${props.environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          // Delete PDFs after 30 days (adjust as needed)
          expiration: cdk.Duration.days(30),
          id: 'DeleteOldPdfs'
        }
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'], // Restrict in production
          allowedHeaders: ['*'],
          maxAge: 3000
        }
      ],
      removalPolicy: props.environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'prod',
    });

    // Lambda function
    this.function = new lambda.Function(this, 'HtmlToPdfFunction', {
      functionName: `html-to-pdf-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../lambda-deploy')
      ),
      memorySize: props.memorySize,
      timeout: cdk.Duration.seconds(props.timeout),
      reservedConcurrentExecutions: props.reservedConcurrency,
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: props.environment === 'prod' ? 'INFO' : 'DEBUG',
        PDF_BUCKET_NAME: this.bucket.bucketName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1' // Reuse HTTP connections
      },
      tracing: props.enableXRay
        ? lambda.Tracing.ACTIVE
        : lambda.Tracing.DISABLED,
      logRetention: props.logRetention as logs.RetentionDays,
      description: 'Convert HTML to PDF using Puppeteer and Chromium',
      layers: [
        // Use @sparticuz/chromium Lambda layer
        // Layer ARN for eu-west-1: arn:aws:lambda:eu-west-1:764866452798:layer:chrome-aws-lambda:43
        lambda.LayerVersion.fromLayerVersionArn(
          this,
          'ChromiumLayer',
          'arn:aws:lambda:eu-west-1:764866452798:layer:chrome-aws-lambda:43'
        )
      ]
    });

    // Grant S3 permissions to Lambda
    this.bucket.grantReadWrite(this.function);

    // Enable Lambda Function URL
    const functionUrl = this.function.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE, // Public access (as per plan)
      cors: {
        allowedOrigins: ['*'], // Restrict in production
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.seconds(300)
      }
    });

    // CloudWatch Alarms
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: `HTML-to-PDF Alarms (${props.environment})`
    });

    // Alarm: Error rate > 1%
    const errorAlarm = new cloudwatch.Alarm(this, 'ErrorAlarm', {
      alarmName: `html-to-pdf-${props.environment}-errors`,
      metric: this.function.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum'
      }),
      threshold: 1,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Lambda function is experiencing errors'
    });
    errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Alarm: Duration > 25 seconds (close to timeout)
    const durationAlarm = new cloudwatch.Alarm(this, 'DurationAlarm', {
      alarmName: `html-to-pdf-${props.environment}-duration`,
      metric: this.function.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: 'Average'
      }),
      threshold: 25000, // 25 seconds
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Lambda function is taking too long (approaching timeout)'
    });
    durationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Alarm: Throttles (concurrent execution limit reached)
    const throttleAlarm = new cloudwatch.Alarm(this, 'ThrottleAlarm', {
      alarmName: `html-to-pdf-${props.environment}-throttles`,
      metric: this.function.metricThrottles({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum'
      }),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Lambda function is being throttled (concurrent limit reached)'
    });
    throttleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Outputs
    new cdk.CfnOutput(this, 'FunctionName', {
      value: this.function.functionName,
      description: 'Lambda function name',
      exportName: `${id}-FunctionName`
    });

    new cdk.CfnOutput(this, 'FunctionArn', {
      value: this.function.functionArn,
      description: 'Lambda function ARN',
      exportName: `${id}-FunctionArn`
    });

    new cdk.CfnOutput(this, 'FunctionUrl', {
      value: functionUrl.url,
      description: 'Lambda Function URL (public endpoint)',
      exportName: `${id}-FunctionUrl`
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket for storing PDFs',
      exportName: `${id}-BucketName`
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: alarmTopic.topicArn,
      description: 'SNS topic for CloudWatch alarms',
      exportName: `${id}-AlarmTopicArn`
    });
  }
}
