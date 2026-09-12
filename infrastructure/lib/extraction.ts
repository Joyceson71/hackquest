import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';

export interface ExtractionStackProps extends cdk.StackProps {
  transcriptsBucket: s3.Bucket;
  mainTable: dynamodb.Table;
}

export class ExtractionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ExtractionStackProps) {
    super(scope, id, props);

    // Lambda: fn-extract-actions
    // Least privilege: S3:GetObject (raw-transcripts), DynamoDB:PutItem (ProposedItems), DynamoDB:UpdateItem+Query (Meetings)
    const extractActionsFn = new nodejs.NodejsFunction(this, 'ExtractActionsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../functions/extract-actions/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(90),
      memorySize: 512,
      environment: {
        TABLE_NAME: props.mainTable.tableName,
      },
      projectRoot: path.join(__dirname, '../../'),
    });

    // Grant S3 read-only to extract-actions
    props.transcriptsBucket.grantRead(extractActionsFn);

    // Grant DynamoDB PutItem for ProposedItems + UpdateItem/Query for Meetings
    extractActionsFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
      resources: [props.mainTable.tableArn],
    }));

    // Grant Bedrock InvokeModel
    extractActionsFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'], // In production, restrict to specific model ARN
    }));

    // EventBridge trigger — ObjectCreated event
    new events.Rule(this, 'TranscriptUploadedRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [props.transcriptsBucket.bucketName],
          },
        },
      },
      targets: [new targets.LambdaFunction(extractActionsFn)],
    });
  }
}
