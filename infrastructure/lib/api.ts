import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  transcriptsBucket: s3.Bucket;
  mainTable: dynamodb.Table;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Cognito User Pool — email sign-in, auto-verify
    const userPool = new cognito.UserPool(this, 'MeetingCompilerUserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'MeetingCompilerClient', {
      userPool,
      generateSecret: false,
    });

    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;

    // Lambda: fn-api
    // Permissions: DynamoDB GetItem, Query, UpdateItem (all), PutItem (ConfirmedActions, AuditLog)
    const serveApiFn = new nodejs.NodejsFunction(this, 'ServeApiFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../functions/serve-api/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: props.mainTable.tableName,
        BUCKET_NAME: props.transcriptsBucket.bucketName,
        USER_POOL_ID: userPool.userPoolId,
      },
      projectRoot: path.join(__dirname, '../../'),
    });

    // Grant Lambda permission to ListUsers in the User Pool
    serveApiFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:ListUsers'],
      resources: [userPool.userPoolArn],
    }));

    // Grant DynamoDB read/write to fn-api
    props.mainTable.grantReadWriteData(serveApiFn);

    // Grant S3 read/write for presigned PUT/GET URLs
    props.transcriptsBucket.grantReadWrite(serveApiFn);

    // API Gateway (REST API with Cognito Authorizer)
    const api = new apigw.RestApi(this, 'MeetingCompilerApi', {
      restApiName: 'MeetingCompiler API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS, // In production: restrict to CloudFront domain
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      deployOptions: {
        throttlingRateLimit: 50,   // steady-state req/s
        throttlingBurstLimit: 100,  // burst req/s
      },
    });

    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'MeetingCompilerAuthorizer', {
      cognitoUserPools: [userPool],
    });

    const lambdaIntegration = new apigw.LambdaIntegration(serveApiFn);
    const authOpts = { authorizer, authorizationType: apigw.AuthorizationType.COGNITO };

    // Routes
    const meetings = api.root.addResource('meetings');
    meetings.addMethod('GET', lambdaIntegration, authOpts);
    meetings.addMethod('POST', lambdaIntegration, authOpts);

    const singleMeeting = meetings.addResource('{id}');
    singleMeeting.addMethod('GET', lambdaIntegration, authOpts);
    singleMeeting.addMethod('PATCH', lambdaIntegration, authOpts);
    singleMeeting.addMethod('DELETE', lambdaIntegration, authOpts);

    const upload = singleMeeting.addResource('upload');
    upload.addMethod('POST', lambdaIntegration, authOpts);

    const proposedItems = singleMeeting.addResource('proposed-items');
    proposedItems.addMethod('GET', lambdaIntegration, authOpts);

    const singleProposed = proposedItems.addResource('{itemId}');
    singleProposed.addMethod('PUT', lambdaIntegration, authOpts);

    const confirmedActions = singleMeeting.addResource('confirmed-actions');
    confirmedActions.addMethod('GET', lambdaIntegration, authOpts);

    const singleAction = confirmedActions.addResource('{actionId}');
    singleAction.addMethod('GET', lambdaIntegration, authOpts);
    singleAction.addMethod('PUT', lambdaIntegration, authOpts);
    singleAction.addMethod('DELETE', lambdaIntegration, authOpts);

    // Escalation sub-resources: /confirmed-actions/{actionId}/escalation/accept|decline
    const escalationResource = singleAction.addResource('escalation');
    const escalationAccept = escalationResource.addResource('accept');
    escalationAccept.addMethod('POST', lambdaIntegration, authOpts);
    const escalationDecline = escalationResource.addResource('decline');
    escalationDecline.addMethod('POST', lambdaIntegration, authOpts);

    // Escalations inbox: /meetings/{id}/escalations
    const escalations = singleMeeting.addResource('escalations');
    escalations.addMethod('GET', lambdaIntegration, authOpts);

    // Participants: /meetings/{id}/participants/unavailable
    const participants = singleMeeting.addResource('participants');
    const unavailable = participants.addResource('unavailable');
    unavailable.addMethod('POST', lambdaIntegration, authOpts);

    // Employees Directory: /employees
    const employees = api.root.addResource('employees');
    employees.addMethod('GET', lambdaIntegration, authOpts);

    this.apiUrl = api.url;

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
  }
}
