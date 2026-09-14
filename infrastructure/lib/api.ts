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
    const serveApiFn = new nodejs.NodejsFunction(this, 'ServeApiFunctionV2', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../functions/api/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: props.mainTable.tableName,
        BUCKET_NAME: props.transcriptsBucket.bucketName,
        USER_POOL_ID: userPool.userPoolId,
        ADMIN_EMAILS: 'admin@example.com,joycesondanielraj00@gmail.com',
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

    // Use wildcard proxy to prevent Lambda Resource Policy size limit (20KB)
    const apiProxy = api.root.addResource('{proxy+}');
    apiProxy.addMethod('ANY', lambdaIntegration, authOpts);
    api.root.addMethod('ANY', lambdaIntegration, authOpts);
    // ─── Gateway Responses: inject CORS headers on 401/403 ───────────────────
    // When the Cognito authorizer rejects a request, API Gateway returns the
    // 401/403 BEFORE the Lambda runs, so the Lambda's CORS headers are never
    // sent. This means the browser gets a CORS-blocked response and throws a
    // TypeError('Failed to fetch'), making the error invisible to the app.
    // Adding Gateway Responses here ensures CORS headers are always present.
    const corsResponseParams = {
      'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
      'gatewayresponse.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      'gatewayresponse.header.Access-Control-Allow-Methods': "'GET,POST,PUT,PATCH,DELETE,OPTIONS'",
    };

    new apigw.GatewayResponse(this, 'UnauthorizedGatewayResponse', {
      restApi: api,
      type: apigw.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: corsResponseParams,
      templates: {
        'application/json': '{"message": "$context.authorizer.claims.iss Unauthorized", "error": "Unauthorized"}',
      },
    });

    new apigw.GatewayResponse(this, 'AccessDeniedGatewayResponse', {
      restApi: api,
      type: apigw.ResponseType.ACCESS_DENIED,
      statusCode: '403',
      responseHeaders: corsResponseParams,
      templates: {
        'application/json': '{"message": "Access Denied", "error": "Forbidden"}',
      },
    });

    new apigw.GatewayResponse(this, 'ExpiredTokenGatewayResponse', {
      restApi: api,
      type: apigw.ResponseType.EXPIRED_TOKEN,
      statusCode: '401',
      responseHeaders: corsResponseParams,
      templates: {
        'application/json': '{"message": "Token expired", "error": "Unauthorized"}',
      },
    });

    new apigw.GatewayResponse(this, 'InvalidSignatureGatewayResponse', {
      restApi: api,
      type: apigw.ResponseType.INVALID_SIGNATURE,
      statusCode: '401',
      responseHeaders: corsResponseParams,
      templates: {
        'application/json': '{"message": "Invalid signature", "error": "Unauthorized"}',
      },
    });

    // ─── Outputs ─────────────────────────────────────────────────────────────


    this.apiUrl = api.url;

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
  }
}
