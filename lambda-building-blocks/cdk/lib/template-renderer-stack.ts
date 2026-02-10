import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import * as path from 'path';

export interface TemplateRendererStackProps extends cdk.StackProps {
  environment: 'dev' | 'prod';
  alertEmail?: string;
}

export class TemplateRendererStack extends cdk.Stack {
  public readonly functionUrl: string;

  constructor(scope: Construct, id: string, props: TemplateRendererStackProps) {
    super(scope, id, props);

    const { environment, alertEmail } = props;

    // Lambda Function
    const functionName = `template-renderer-${environment}`;

    const templateFunction = new lambda.Function(this, 'TemplateRendererFunction', {
      functionName,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../functions/template-renderer/lambda-deploy')),
      memorySize: 512, // Template rendering is lightweight
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_ENV: environment === 'prod' ? 'production' : 'development',
        LOG_LEVEL: environment === 'prod' ? 'INFO' : 'DEBUG',
      },
      reservedConcurrentExecutions: environment === 'dev' ? 5 : 20,
      logRetention: environment === 'dev'
        ? logs.RetentionDays.ONE_WEEK
        : logs.RetentionDays.ONE_MONTH,
    });

    // Function URL with CORS
    const fnUrl = templateFunction.addFunctionUrl({
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
      const alarmTopic = new sns.Topic(this, 'TemplateRendererAlarmTopic', {
        displayName: `Template Renderer ${environment} Alarms`,
      });

      alarmTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));

      // Error Alarm
      const errorAlarm = new cloudwatch.Alarm(this, 'TemplateRendererErrorAlarm', {
        alarmName: `${functionName}-errors`,
        alarmDescription: 'Alert when template rendering error rate exceeds 1%',
        metric: templateFunction.metricErrors({
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
      const durationAlarm = new cloudwatch.Alarm(this, 'TemplateRendererDurationAlarm', {
        alarmName: `${functionName}-duration`,
        alarmDescription: 'Alert when template rendering duration exceeds 5 seconds',
        metric: templateFunction.metricDuration({
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5000, // 5 seconds in milliseconds
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      durationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

      // Throttle Alarm
      const throttleAlarm = new cloudwatch.Alarm(this, 'TemplateRendererThrottleAlarm', {
        alarmName: `${functionName}-throttles`,
        alarmDescription: 'Alert when template rendering is throttled',
        metric: templateFunction.metricThrottles({
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
      description: 'Template Renderer Function URL',
      exportName: `TemplateRendererUrl-${environment}`,
    });

    new cdk.CfnOutput(this, 'FunctionName', {
      value: templateFunction.functionName,
      description: 'Lambda Function Name',
      exportName: `TemplateRendererFunctionName-${environment}`,
    });

    new cdk.CfnOutput(this, 'FunctionArn', {
      value: templateFunction.functionArn,
      description: 'Lambda Function ARN',
      exportName: `TemplateRendererFunctionArn-${environment}`,
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'i2speedex-lambda-building-blocks');
    cdk.Tags.of(this).add('Component', 'template-renderer');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
