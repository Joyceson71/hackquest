#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage';
import { ApiStack } from '../lib/api';
import { CdnStack } from '../lib/cdn';
import { ExtractionStack } from '../lib/extraction';

const app = new cdk.App();

// Create Storage Stack (S3 and DynamoDB)
const storageStack = new StorageStack(app, 'MeetingCompilerStorageStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

// Create API Stack (API Gateway, Lambdas, Cognito)
const apiStack = new ApiStack(app, 'MeetingCompilerApiStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  transcriptsBucket: storageStack.transcriptsBucket,
  mainTable: storageStack.mainTable,
});
apiStack.addDependency(storageStack);

// Create Extraction Stack (Lambda, Bedrock)
const extractionStack = new ExtractionStack(app, 'MeetingCompilerExtractionStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  transcriptsBucket: storageStack.transcriptsBucket,
  mainTable: storageStack.mainTable,
});
extractionStack.addDependency(storageStack);

// Create CDN Stack (CloudFront and Frontend Hosting Bucket)
const cdnStack = new CdnStack(app, 'MeetingCompilerCdnStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
