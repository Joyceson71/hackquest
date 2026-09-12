import { CognitoJwtVerifier } from "aws-jwt-verify";

// Verify that the environment variables are present
const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: "id",
  clientId: CLIENT_ID,
});

export const handler = async (event: any) => {
  const token = event.authorizationToken?.replace('Bearer ', '');
  if (!token) {
    return generatePolicy('user', 'Deny', event.methodArn);
  }

  try {
    const payload = await verifier.verify(token);
    
    // Default to ORGANIZER if no specific claim is set, or base it on groups if needed.
    // For MVP, we assume any authenticated user has access, but we extract the role for the API to use.
    // In a real app, this might come from custom attributes or groups.
    const role = payload['custom:role'] || 'ORGANIZER'; 
    
    return generatePolicy(payload.sub, 'Allow', event.methodArn, {
      role: role as string,
      email: payload.email as string
    });
  } catch (err) {
    console.log("Token verification failed", err);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

const generatePolicy = (principalId: string, effect: string, resource: string, context?: any) => {
  const authResponse: any = { principalId };
  if (effect && resource) {
    authResponse.policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource, // Alternatively, restrict to specific routes
        },
      ],
    };
  }
  if (context) {
    authResponse.context = context;
  }
  return authResponse;
};
