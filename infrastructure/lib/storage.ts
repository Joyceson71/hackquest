import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class StorageStack extends cdk.Stack {
  public readonly transcriptsBucket: s3.Bucket;
  public readonly mainTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket — raw-transcripts
    // Block all public access. 90-day lifecycle for auto-delete.
    this.transcriptsBucket = new s3.Bucket(this, 'RawTranscriptsBucket', {
      bucketName: `raw-transcripts-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      eventBridgeEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        { expiration: cdk.Duration.days(90) },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'], // Restricted to CloudFront domain in production via API
          allowedHeaders: ['*'],
        },
      ],
    });

    // DynamoDB — Single table design for all entities
    // PK/SK pattern supports: Meetings, ProposedItems, ConfirmedActions, AuditLog
    this.mainTable = new dynamodb.Table(this, 'MeetingCompilerTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true, // Audit trail protection
    });
  }
}
