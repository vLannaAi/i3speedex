import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface SaleModuleS3StackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
}

export class SaleModuleS3Stack extends cdk.Stack {
  public readonly documentsBucket: s3.Bucket;
  public readonly attachmentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: SaleModuleS3StackProps) {
    super(scope, id, props);

    const { environment } = props;
    const isProd = environment === 'prod';

    // ========================================
    // Documents Bucket (PDFs, XML invoices)
    // ========================================
    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `i2speedex-documents-${environment}-${this.account}`,

      // Access control
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,

      // Encryption
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,

      // Versioning
      versioned: isProd,

      // Lifecycle policies
      lifecycleRules: [
        {
          id: 'DeleteOldDevDocuments',
          enabled: environment === 'dev',
          expiration: cdk.Duration.days(30), // Delete dev documents after 30 days
        },
        {
          id: 'TransitionToIA',
          enabled: isProd,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(90), // Move to Intelligent Tiering after 90 days
            },
          ],
        },
        {
          id: 'TransitionToGlacier',
          enabled: isProd,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365), // Archive after 1 year
            },
          ],
        },
      ],

      // CORS for direct browser uploads (if needed)
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: environment === 'prod'
            ? ['https://sales.i2speedex.com']
            : ['http://localhost:3000', `https://${environment}-sales.i2speedex.com`],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],

      // Auto delete objects on stack deletion (dev only)
      autoDeleteObjects: environment === 'dev',
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // Attachments Bucket (file uploads)
    // ========================================
    this.attachmentsBucket = new s3.Bucket(this, 'AttachmentsBucket', {
      bucketName: `i2speedex-attachments-${environment}-${this.account}`,

      // Access control
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,

      // Encryption
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,

      // Versioning
      versioned: isProd,

      // Lifecycle policies
      lifecycleRules: [
        {
          id: 'DeleteOldDevAttachments',
          enabled: environment === 'dev',
          expiration: cdk.Duration.days(30),
        },
        {
          id: 'TransitionToIA',
          enabled: isProd,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(180), // Move to Intelligent Tiering after 6 months
            },
          ],
        },
      ],

      // CORS for direct browser uploads
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: environment === 'prod'
            ? ['https://sales.i2speedex.com']
            : ['http://localhost:3000', `https://${environment}-sales.i2speedex.com`],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3600,
        },
      ],

      // Auto delete objects on stack deletion (dev only)
      autoDeleteObjects: environment === 'dev',
      removalPolicy: environment === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // Bucket Policies & Access
    // ========================================

    // Allow CloudFront OAI to read documents (will be configured when CloudFront is set up)
    // For now, we'll just document the folder structure

    /*
    Documents Bucket Structure:
    /pdfs/
      /{year}/
        /{sale_id}/
          invoice-{sale_id}.pdf
          invoice-{sale_id}-{language}.pdf
    /xml/
      /{year}/
        /{sale_id}/
          invoice-{sale_id}.xml (SDI format)
    /html/
      /{year}/
        /{sale_id}/
          invoice-{sale_id}.html

    Attachments Bucket Structure:
    /sales/
      /{sale_id}/
        {filename}
    /buyers/
      /{buyer_id}/
        {filename}
    /temp/
      {temp_upload_id}/
        {filename}
    */

    // ========================================
    // CloudWatch Metrics & Alarms (Production)
    // ========================================
    if (isProd) {
      // Alarm for bucket size growth
      const bucketSizeMetric = new cloudwatch.Metric({
        namespace: 'AWS/S3',
        metricName: 'BucketSizeBytes',
        statistic: 'Average',
        period: cdk.Duration.days(1),
        dimensionsMap: {
          BucketName: this.documentsBucket.bucketName,
          StorageType: 'StandardStorage',
        },
      });

      new cloudwatch.Alarm(this, 'DocumentsBucketSizeAlarm', {
        alarmName: `${this.documentsBucket.bucketName}-size`,
        alarmDescription: 'Alert when documents bucket exceeds 50GB',
        metric: bucketSizeMetric,
        threshold: 50 * 1024 * 1024 * 1024, // 50 GB in bytes
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: this.documentsBucket.bucketName,
      description: 'Documents S3 Bucket Name',
      exportName: `DocumentsBucketName-${environment}`,
    });

    new cdk.CfnOutput(this, 'DocumentsBucketArn', {
      value: this.documentsBucket.bucketArn,
      description: 'Documents S3 Bucket ARN',
      exportName: `DocumentsBucketArn-${environment}`,
    });

    new cdk.CfnOutput(this, 'AttachmentsBucketName', {
      value: this.attachmentsBucket.bucketName,
      description: 'Attachments S3 Bucket Name',
      exportName: `AttachmentsBucketName-${environment}`,
    });

    new cdk.CfnOutput(this, 'AttachmentsBucketArn', {
      value: this.attachmentsBucket.bucketArn,
      description: 'Attachments S3 Bucket ARN',
      exportName: `AttachmentsBucketArn-${environment}`,
    });

    // ========================================
    // Tags
    // ========================================
    cdk.Tags.of(this).add('Project', 'i2speedex-sale-module');
    cdk.Tags.of(this).add('Component', 's3-storage');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
