import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID!;

export const handleEmployees = async (event: any) => {
  try {
    const command = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      AttributesToGet: ['email', 'name', 'email_verified'],
    });
    const response = await cognitoClient.send(command);
    const users = (response.Users || []).map(u => {
      const email = u.Attributes?.find(a => a.Name === 'email')?.Value || '';
      const name = u.Attributes?.find(a => a.Name === 'name')?.Value || email;
      const isVerified = u.Attributes?.find(a => a.Name === 'email_verified')?.Value === 'true';
      return {
        id: u.Username,
        email,
        name,
        status: u.UserStatus,
        isVerified,
        created: u.UserCreateDate,
        lastModified: u.UserLastModifiedDate
      };
    });
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(users)
    };
  } catch (err: any) {
    console.error('Error listing users:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
